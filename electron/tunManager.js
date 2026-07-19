// TUN engine — the "Outline backend under our shell" path.
//
// Captures the whole device's traffic through a system TUN adapter (sing-box,
// which sets up WinTUN + routes automatically) and forwards it to our
// napas-ss-proxy helper, which speaks Shadowsocks WITH the Outline prefix.
// This mirrors exactly what the official Outline / VanyaVPN client does.
//
//   device traffic ──▶ sing-box TUN ──▶ SOCKS5 ──▶ napas-ss-proxy (prefix) ──▶ server
//
// The server IP is routed "direct" so the helper's own connection to it does
// not loop back into the tunnel.

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const net = require('net');
const { EventEmitter } = require('events');
const { resolveKey } = require('./configGenerator');
const { waitForPort, measureLatency, checkConnectivityDirect } = require('./netUtils');

const HELPER_PORT = 10810;
const emitter = new EventEmitter();

let sbProcess = null;
let helperProcess = null;
let helperOutput = '';
let sbOutput = '';
let status = { connected: false, pid: null, mode: 'tun' };
let lastKey = null;
let lastServer = null;
let userStopped = false;

function resDir() {
  return process.resourcesPath || path.join(__dirname, '..', 'assets');
}
function pickBin(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name;
  const packaged = path.join(resDir(), exe);
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'assets', exe);
}
const getSingboxPath = () => pickBin('sing-box');
const getHelperPath  = () => pickBin('napas-ss-proxy');

const helperConfigPath = () => path.join(os.tmpdir(), 'napasvpn_ss.json');
const sbConfigPath     = () => path.join(os.tmpdir(), 'napasvpn_singbox.json');

function onUnexpectedExit(cb) { emitter.on('unexpected-exit', cb); }
function getLastKey() { return lastKey; }
function getLastServer() { return lastServer; }
function getStatus() { return { ...status }; }

function stopHelper() {
  if (helperProcess) { try { helperProcess.kill(); } catch (_) {} helperProcess = null; }
  try { fs.unlinkSync(helperConfigPath()); } catch (_) {}
}
function stopSingbox() {
  if (sbProcess) { try { sbProcess.kill(); } catch (_) {} sbProcess = null; }
  try { fs.unlinkSync(sbConfigPath()); } catch (_) {}
}

async function startHelper(resolved) {
  const helperPath = getHelperPath();
  if (!fs.existsSync(helperPath)) throw new Error(`Модуль napas-ss-proxy не найден:\n${helperPath}`);
  const cfg = {
    server: resolved.host, server_port: resolved.port,
    method: resolved.method, password: resolved.password, prefix: resolved.prefix || '',
  };
  fs.writeFileSync(helperConfigPath(), JSON.stringify(cfg), 'utf-8');
  helperProcess = spawn(helperPath, ['-config', helperConfigPath(), '-listen', `127.0.0.1:${HELPER_PORT}`], { windowsHide: true });
  helperOutput = '';
  helperProcess.stdout?.on('data', (d) => { helperOutput += d.toString(); });
  helperProcess.stderr?.on('data', (d) => { helperOutput += d.toString(); });
  helperProcess.on('exit', () => { helperProcess = null; });
  const ok = await waitForPort(HELPER_PORT, '127.0.0.1', 5000);
  if (!ok) { const d = helperOutput.slice(-300); stopHelper(); throw new Error(`napas-ss-proxy не открыл порт ${HELPER_PORT}${d ? '\n' + d : ''}`); }
}

/** sing-box TUN config: capture everything, bypass the server IP, DNS over the tunnel. */
function buildSingboxConfig(serverHost) {
  // Keep the helper's own connection to the server outside the tunnel.
  const bypass = net.isIP(serverHost)
    ? { ip_cidr: [`${serverHost}/32`], outbound: 'direct' }
    : { domain: [serverHost], outbound: 'direct' };

  return {
    log: { level: 'warn' },
    dns: {
      servers: [{ type: 'tcp', tag: 'remote-dns', server: '1.1.1.1', detour: 'proxy' }],
      final: 'remote-dns',
      strategy: 'prefer_ipv4',
    },
    inbounds: [{
      type: 'tun',
      tag: 'tun-in',
      interface_name: 'NapasVPN',
      address: ['172.19.0.1/30'],
      mtu: 1400,
      auto_route: true,
      // strict_route off: safer teardown if the process is force-killed on
      // Windows (WinTUN adapters are ephemeral and vanish with the process).
      strict_route: false,
      stack: 'gvisor',
    }],
    outbounds: [
      { type: 'socks', tag: 'proxy', server: '127.0.0.1', server_port: HELPER_PORT, version: '5' },
      { type: 'direct', tag: 'direct' },
    ],
    route: {
      auto_detect_interface: true,
      final: 'proxy',
      rules: [
        { action: 'sniff' },
        { protocol: 'dns', action: 'hijack-dns' },
        bypass,
      ],
    },
  };
}

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
    return { success: false, error: 'TUN-режим поддерживает только Shadowsocks/Outline-ключи.' };
  }
  lastServer = {
    host: resolved.host, port: resolved.port, protocol: resolved.kind,
    tag: resolved.tag || '', prefix: resolved.prefix || '', mode: 'tun',
  };

  // 1. Prefix helper
  try {
    await startHelper(resolved);
  } catch (err) {
    stopHelper();
    return { success: false, error: err.message };
  }

  // 2. sing-box
  const sbPath = getSingboxPath();
  if (!fs.existsSync(sbPath)) {
    stopHelper();
    return { success: false, error: `sing-box не найден:\n${sbPath}` };
  }
  try {
    fs.writeFileSync(sbConfigPath(), JSON.stringify(buildSingboxConfig(resolved.host), null, 2), 'utf-8');
  } catch (err) {
    stopHelper();
    return { success: false, error: `Не удалось записать конфиг TUN:\n${err.message}` };
  }

  return new Promise((resolve) => {
    let resolved2 = false;
    const finish = (r) => { if (!resolved2) { resolved2 = true; resolve(r); } };

    try {
      sbProcess = spawn(sbPath, ['run', '-c', sbConfigPath()], {
        windowsHide: true,
        cwd: path.dirname(sbPath), // wintun.dll sits next to sing-box.exe
      });
    } catch (err) {
      stopHelper();
      return finish({ success: false, error: `Не удалось запустить sing-box:\n${err.message}` });
    }

    sbOutput = '';
    const onData = (d) => { sbOutput += d.toString(); };
    sbProcess.stdout?.on('data', onData);
    sbProcess.stderr?.on('data', onData);

    sbProcess.on('error', (err) => {
      stopSingbox(); stopHelper();
      finish({ success: false, error: `Ошибка запуска sing-box:\n${err.message}` });
    });
    sbProcess.on('exit', (code) => {
      const wasConnected = resolved2 && status.connected;
      sbProcess = null;
      stopHelper();
      status = { connected: false, pid: null, mode: 'tun' };
      if (wasConnected && !userStopped) emitter.emit('unexpected-exit', { code });
      finish({ success: false, error: `sing-box завершился (код ${code}).\n\nВывод:\n${sbOutput.slice(-700) || '(пусто)'}` });
    });

    // Give the TUN adapter a few seconds to come up, then verify real traffic.
    setTimeout(async () => {
      if (resolved2) return;
      const conn = await checkConnectivityDirect(10000);
      status = { connected: true, pid: sbProcess?.pid ?? null, mode: 'tun', server: lastServer };
      if (!conn.ok) {
        finish({
          success: true, mode: 'tun', server: lastServer,
          warning:
            `TUN поднят, но проверка трафика не прошла (${conn.detail}).\n` +
            `Если сайты не открываются — сообщите, покажу лог sing-box.`,
        });
        return;
      }
      finish({ success: true, mode: 'tun', server: lastServer });
    }, 3500);
  });
}

async function stop() {
  userStopped = true;
  stopSingbox();
  stopHelper();
  status = { connected: false, pid: null, mode: 'tun' };
}

function getSingboxLog() { return sbOutput.slice(-2000); }

module.exports = { start, stop, getStatus, getLastKey, getLastServer, onUnexpectedExit, measureLatency, getSingboxLog, buildSingboxConfig };
