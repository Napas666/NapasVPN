// Outline engine — vendored 1:1 from VanyaVPN (which is Outline, Apache-2.0).
//
// This drives the exact binaries the working VanyaVPN uses on Windows:
//   - tun2socks.exe   — the engine (sing-box + Outline shadowsocks prefix),
//                       moves packets between the TAP adapter and the server.
//   - OutlineService  — a Windows service that configures routing (all traffic
//                       → TAP, server IP bypassed) over a named pipe.
//   - tap-windows6    — the outline-tap0 virtual adapter.
//
// We build the tunnel config ourselves (from the resolved ss/ssconf key) in the
// modern Outline "configyaml" format, so no Go bridge is needed.

const { spawn, execFileSync, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const { resolveKey } = require('./configGenerator');
const { measureLatency, checkConnectivityDirect } = require('./netUtils');
const { OutlineRouting } = require('./outlineRouting');

// Outline's fixed TAP parameters (must match add_tap_device.bat).
const TAP_NAME = 'outline-tap0';
const TAP_IP   = '10.0.85.2';
const TAP_GW   = '10.0.85.1';
const TAP_MASK = '255.255.255.0';
const TUN_DNS  = ['1.1.1.1', '9.9.9.9'];

const emitter = new EventEmitter();

let tun2socksProc = null;
let routing = null;
let tunOutput = '';
let installLog = '';
let status = { connected: false, pid: null, mode: 'outline' };
let lastKey = null;
let lastServer = null;
let lastConfig = null;
let lastConnCheck = null;
let userStopped = false;

function outlineDir() {
  const packaged = path.join(process.resourcesPath || '', 'outline');
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'assets', 'outline');
}
const bin = (name) => path.join(outlineDir(), name);

function onUnexpectedExit(cb) { emitter.on('unexpected-exit', cb); }
function getLastKey() { return lastKey; }
function getLastServer() { return lastServer; }
function getStatus() { return { ...status }; }

// ── Install: TAP adapter + OutlineService (idempotent, admin required) ─────────

function isServiceRunning() {
  try { return /RUNNING/.test(execSync('sc query OutlineService', { timeout: 8000, windowsHide: true }).toString()); }
  catch (_) { return false; }
}
function tapExists() {
  try { execSync(`netsh interface show interface name=${TAP_NAME}`, { timeout: 8000, windowsHide: true }); return true; }
  catch (_) { return false; }
}

function ensureInstalled() {
  if (process.platform !== 'win32') throw new Error('Outline-движок доступен только на Windows.');
  const dir = outlineDir();
  installLog = '';

  if (!tapExists()) {
    installLog += '[tap] installing outline-tap0...\n';
    try {
      installLog += execSync(`"${path.join(dir, 'add_tap_device.bat')}"`, { cwd: dir, timeout: 180000, windowsHide: true }).toString();
    } catch (e) {
      installLog += '[tap] ERROR: ' + (e.stdout ? e.stdout.toString() : e.message) + '\n';
      if (!tapExists()) throw new Error('Не удалось создать TAP-адаптер outline-tap0:\n' + installLog.slice(-500));
    }
  }

  if (!isServiceRunning()) {
    installLog += '[svc] installing/starting OutlineService...\n';
    try {
      installLog += execSync(`"${path.join(dir, 'install_windows_service.bat')}"`, { cwd: dir, timeout: 60000, windowsHide: true }).toString();
    } catch (e) {
      installLog += '[svc] script: ' + (e.stdout ? e.stdout.toString() : e.message) + '\n';
    }
    if (!isServiceRunning()) {
      // Fallback: install the service directly (quoted ImagePath).
      try { execSync('net start OutlineService', { timeout: 15000, windowsHide: true }); }
      catch (_) {
        try {
          execFileSync('sc', ['create', 'OutlineService', 'binpath=', `"${path.join(dir, 'OutlineService.exe')}"`, 'displayname=', 'OutlineService', 'start=', 'auto'], { timeout: 15000, windowsHide: true });
        } catch (__) {}
        try { execSync('net start OutlineService', { timeout: 15000, windowsHide: true }); } catch (___) {}
      }
    }
    if (!isServiceRunning()) throw new Error('Не удалось запустить OutlineService:\n' + installLog.slice(-500));
  }
}

// ── Config ─────────────────────────────────────────────────────────────────────

// Outline "configyaml" tunnel config, on a SINGLE line (a multi-line argv value
// is risky on Windows). YAML flow mapping — double-quoted scalars support the
// \xNN prefix escapes; the whole thing is still valid YAML the Go parser reads.
function buildTunnelConfig(resolved) {
  let prefixField = '';
  if (resolved.prefix) {
    let esc = '';
    for (const ch of resolved.prefix) esc += '\\x' + ch.charCodeAt(0).toString(16).padStart(2, '0');
    prefixField = `, "prefix": "${esc}"`;
  }
  return `transport: {"$type": "shadowsocks", "endpoint": "${resolved.host}:${resolved.port}", ` +
         `"cipher": "${resolved.method}", "secret": "${resolved.password}"${prefixField}}`;
}

// ── Connect / disconnect ───────────────────────────────────────────────────────

async function start(key) {
  userStopped = false;
  lastKey = key;
  await stop();

  let resolved;
  try {
    resolved = await resolveKey(key);
  } catch (err) {
    return { success: false, error: `Ошибка разбора ключа:\n${err.message}` };
  }
  if (resolved.kind !== 'shadowsocks') {
    return { success: false, error: 'Outline-движок поддерживает только Shadowsocks/Outline-ключи.' };
  }
  lastServer = {
    host: resolved.host, port: resolved.port, protocol: resolved.kind,
    tag: resolved.tag || '', prefix: resolved.prefix || '', mode: 'outline',
  };
  lastConfig = buildTunnelConfig(resolved);

  // 1. Ensure the TAP adapter + routing service exist.
  try {
    ensureInstalled();
  } catch (err) {
    return { success: false, error: err.message };
  }

  // 2. Configure routing (server bypass) via OutlineService, get adapter index.
  let adapterIndex = '';
  routing = new OutlineRouting();
  routing.onDisconnect = () => {
    if (!userStopped && status.connected) emitter.emit('unexpected-exit', { reason: 'routing' });
  };
  try {
    adapterIndex = await routing.configureRouting(resolved.host, []);
  } catch (err) {
    return { success: false, error: `Служба маршрутизации не настроилась:\n${err.message}` };
  }

  // 3. Launch tun2socks against the TAP adapter.
  const tunPath = bin('tun2socks.exe');
  if (!fs.existsSync(tunPath)) {
    await routing.resetRouting();
    return { success: false, error: `tun2socks не найден:\n${tunPath}` };
  }
  const args = [
    '-keyID', 'napasvpn',
    '-tunName', TAP_NAME,
    '-tunAddr', TAP_IP,
    '-tunGw', TAP_GW,
    '-tunMask', TAP_MASK,
    '-tunDNS', TUN_DNS.join(','),
    '-client', lastConfig,
    '-logLevel', 'info',
    '-dnsFallback',
  ];
  if (adapterIndex) args.push('-adapterIndex', adapterIndex);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (r) => { if (!settled) { settled = true; resolve(r); } };

    try {
      tun2socksProc = spawn(tunPath, args, { windowsHide: true, cwd: outlineDir() });
    } catch (err) {
      routing.resetRouting();
      return finish({ success: false, error: `Не удалось запустить tun2socks:\n${err.message}` });
    }

    tunOutput = '';
    const onData = (d) => {
      tunOutput += d.toString();
      if (!settled && tunOutput.includes('tun2socks running')) {
        // Engine is up; verify real traffic, then report.
        setTimeout(async () => {
          const conn = await checkConnectivityDirect(12000);
          lastConnCheck = conn;
          status = { connected: true, pid: tun2socksProc?.pid ?? null, mode: 'outline', server: lastServer };
          if (!conn.ok) {
            finish({
              success: true, mode: 'outline', server: lastServer,
              warning: `Движок запущен, но проверка трафика не прошла (${conn.detail}). Если сайты не открываются — нажмите 🩺 Диагностика.`,
            });
          } else {
            finish({ success: true, mode: 'outline', server: lastServer });
          }
        }, 800);
      }
    };
    tun2socksProc.stdout?.on('data', onData);
    tun2socksProc.stderr?.on('data', onData);

    tun2socksProc.on('error', (err) => {
      const p = tun2socksProc; tun2socksProc = null;
      if (routing) routing.resetRouting();
      if (!settled) finish({ success: false, error: `Ошибка запуска tun2socks:\n${err.message}` });
    });
    tun2socksProc.on('exit', (code) => {
      const wasConnected = settled && status.connected;
      tun2socksProc = null;
      status = { connected: false, pid: null, mode: 'outline' };
      if (routing) routing.resetRouting();
      if (wasConnected && !userStopped) emitter.emit('unexpected-exit', { code });
      if (!settled) finish({ success: false, error: `tun2socks завершился (код ${code}).\n\nВывод:\n${tunOutput.slice(-800) || '(пусто)'}` });
    });

    // Safety timeout: if "tun2socks running" never appears.
    setTimeout(() => {
      if (!settled) {
        finish({ success: false, error: `tun2socks не сообщил о запуске за 20с.\n\nВывод:\n${tunOutput.slice(-800) || '(пусто)'}` });
        stop();
      }
    }, 20000);
  });
}

async function stop() {
  userStopped = true;
  if (tun2socksProc) { try { tun2socksProc.kill(); } catch (_) {} tun2socksProc = null; }
  if (routing) { try { await routing.resetRouting(); } catch (_) {} routing = null; }
  status = { connected: false, pid: null, mode: 'outline' };
}

// ── Diagnostics ────────────────────────────────────────────────────────────────

function getDiagnostics() {
  const lines = [];
  lines.push('=== NapasVPN diagnostics (Outline engine) ===');
  lines.push('time: ' + new Date().toISOString());
  lines.push('platform: ' + process.platform + ' ' + process.arch);
  lines.push('outline dir: ' + outlineDir());
  lines.push('service running: ' + (process.platform === 'win32' ? isServiceRunning() : 'n/a'));
  lines.push('tap exists: ' + (process.platform === 'win32' ? tapExists() : 'n/a'));
  lines.push('');
  lines.push('--- server ---');
  lines.push(JSON.stringify(lastServer, null, 2));
  lines.push('');
  lines.push('--- connectivity probe ---');
  lines.push(JSON.stringify(lastConnCheck));
  lines.push('');
  lines.push('--- tunnel config ---');
  lines.push(lastConfig || '(none)');
  lines.push('');
  lines.push('--- install log ---');
  lines.push(installLog.slice(-1500) || '(empty)');
  lines.push('');
  lines.push('--- tun2socks output ---');
  lines.push(tunOutput.slice(-6000) || '(empty)');
  return lines.join('\n');
}

module.exports = {
  start, stop, getStatus, getLastKey, getLastServer,
  onUnexpectedExit, measureLatency, getDiagnostics, buildTunnelConfig,
};
