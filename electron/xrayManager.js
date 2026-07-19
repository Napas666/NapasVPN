const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { EventEmitter } = require('events');
const { resolveKey, buildConfig, buildProxyOutbound, socksOutbound } = require('./configGenerator');
const { getXrayExePath } = require('./xrayDownloader');

const SOCKS_PORT  = 10808;
const HTTP_PORT   = 10809;
const HELPER_PORT = 10810; // local SOCKS5 exposed by napas-ss-proxy (Outline prefix)
const emitter = new EventEmitter();

let xrayProcess = null;
let helperProcess = null; // napas-ss-proxy, only for shadowsocks keys with a prefix
let status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
let lastVlessKey = null;
let lastServer = null; // { host, port, protocol, tag, prefix } from the resolved key
let userStopped = false;

function getXrayPath() {
  const userDataPath = getXrayExePath();
  if (fs.existsSync(userDataPath)) return userDataPath;
  return path.join(__dirname, '..', 'assets', 'xray.exe');
}

// napas-ss-proxy is bundled with the installer (extraResources) or lives in
// assets/ during development.
function getHelperPath() {
  const exeName = process.platform === 'win32' ? 'napas-ss-proxy.exe' : 'napas-ss-proxy';
  const packaged = path.join(process.resourcesPath || '', exeName);
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, '..', 'assets', exeName);
}

function getConfigPath() {
  return path.join(os.tmpdir(), 'napasvpn_config.json');
}

function getHelperConfigPath() {
  return path.join(os.tmpdir(), 'napasvpn_ss.json');
}

function stopHelper() {
  if (helperProcess) {
    try { helperProcess.kill(); } catch (_) {}
    helperProcess = null;
  }
  try { fs.unlinkSync(getHelperConfigPath()); } catch (_) {}
}

/**
 * Starts napas-ss-proxy for an Outline shadowsocks key (with prefix) and
 * resolves once its local SOCKS5 port is accepting connections.
 */
async function startHelper(resolved) {
  const helperPath = getHelperPath();
  if (!fs.existsSync(helperPath)) {
    throw new Error(`Модуль napas-ss-proxy не найден:\n${helperPath}`);
  }
  const cfg = {
    server: resolved.host,
    server_port: resolved.port,
    method: resolved.method,
    password: resolved.password,
    prefix: resolved.prefix || '',
  };
  const cfgPath = getHelperConfigPath();
  fs.writeFileSync(cfgPath, JSON.stringify(cfg), 'utf-8');

  helperProcess = spawn(helperPath, ['-config', cfgPath, '-listen', `127.0.0.1:${HELPER_PORT}`], {
    windowsHide: true,
  });
  helperProcess.on('exit', () => { helperProcess = null; });

  const ok = await waitForPort(HELPER_PORT, '127.0.0.1', 5000);
  if (!ok) {
    stopHelper();
    throw new Error(`napas-ss-proxy не открыл порт ${HELPER_PORT}`);
  }
}

/**
 * Waits until port is actually accepting connections (max ~5s).
 */
function waitForPort(port, host = '127.0.0.1', timeout = 5000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    function attempt() {
      const sock = new net.Socket();
      sock.setTimeout(500);
      sock.on('connect', () => { sock.destroy(); resolve(true); });
      sock.on('error',   () => { sock.destroy(); retry(); });
      sock.on('timeout', () => { sock.destroy(); retry(); });
      sock.connect(port, host);
    }
    function retry() {
      if (Date.now() >= deadline) { resolve(false); return; }
      setTimeout(attempt, 300);
    }
    attempt();
  });
}

/**
 * Measures TCP connect latency to host:port (ms), or -1 on failure.
 */
function measureLatency(host, port) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.on('connect', () => {
      const ms = Date.now() - t0;
      sock.destroy();
      resolve({ ms, ok: true });
    });
    sock.on('error',   () => { sock.destroy(); resolve({ ms: -1, ok: false }); });
    sock.on('timeout', () => { sock.destroy(); resolve({ ms: -1, ok: false }); });
    sock.connect(port, host);
  });
}

function getLastKey() { return lastVlessKey; }
function getLastServer() { return lastServer; }

function onUnexpectedExit(cb) {
  emitter.on('unexpected-exit', cb);
}

async function start(vlessKey) {
  userStopped = false;
  lastVlessKey = vlessKey;
  if (xrayProcess) await stop();

  // 1. Resolve the key (ssconf:// keys are fetched over https here) and build
  //    the xray config. Outline shadowsocks keys carry a `prefix` that xray
  //    can't speak, so those go through napas-ss-proxy first and xray just
  //    forwards to it over a local SOCKS5.
  let config, server;
  try {
    const resolved = await resolveKey(vlessKey);
    server = {
      host: resolved.host,
      port: resolved.port,
      protocol: resolved.kind,
      tag: resolved.tag || '',
      prefix: resolved.prefix || '',
    };

    if (resolved.kind === 'shadowsocks' && resolved.prefix) {
      await startHelper(resolved); // throws if it fails to open its port
      config = buildConfig(socksOutbound('127.0.0.1', HELPER_PORT), SOCKS_PORT, HTTP_PORT);
    } else {
      config = buildConfig(buildProxyOutbound(resolved), SOCKS_PORT, HTTP_PORT);
    }
  } catch (err) {
    stopHelper();
    return { success: false, error: `Ошибка разбора ключа:\n${err.message}` };
  }
  lastServer = server;

  // 2. Write config
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    return { success: false, error: `Не удалось записать конфиг:\n${err.message}` };
  }

  // 3. Check xray exists
  const xrayPath = getXrayPath();
  if (!fs.existsSync(xrayPath)) {
    return {
      success: false,
      error: `xray.exe не найден.\nОжидаемый путь:\n${xrayPath}\n\nПерезапустите приложение — оно скачает движок автоматически.`,
    };
  }

  // 4. Spawn xray
  let output = '';

  return new Promise((resolve) => {
    try {
      xrayProcess = spawn(xrayPath, ['run', '-config', configPath], {
        windowsHide: true,
        // xray looks for geoip.dat / geosite.dat in its own directory
        cwd: path.dirname(xrayPath),
      });
    } catch (err) {
      return resolve({ success: false, error: `Не удалось запустить xray:\n${err.message}` });
    }

    let resolved = false;

    const finish = (result) => {
      if (!resolved) {
        resolved = true;
        resolve(result);
      }
    };

    const onData = (data) => { output += data.toString(); };
    xrayProcess.stdout?.on('data', onData);
    xrayProcess.stderr?.on('data', onData);

    xrayProcess.on('error', (err) => {
      xrayProcess = null;
      stopHelper();
      finish({ success: false, error: `Ошибка запуска xray:\n${err.message}` });
    });

    xrayProcess.on('exit', (code) => {
      // If we already resolved successfully, this is an unexpected crash
      const wasConnected = resolved;
      xrayProcess = null;
      stopHelper();
      status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };

      if (wasConnected && !userStopped) {
        emitter.emit('unexpected-exit', { code });
      }

      finish({
        success: false,
        error: `xray завершился (код ${code}).\n\nВывод:\n${output.slice(-600) || '(пусто)'}`,
      });
    });

    // 5. Give xray up to 6 seconds to open the port
    waitForPort(SOCKS_PORT, '127.0.0.1', 6000).then((portOpen) => {
      if (!portOpen) {
        xrayProcess?.kill();
        xrayProcess = null;
        stopHelper();
        finish({
          success: false,
          error: `xray запустился, но порт ${SOCKS_PORT} не открылся.\n\nВывод:\n${output.slice(-600) || '(пусто)'}`,
        });
        return;
      }

      status = { connected: true, pid: xrayProcess?.pid ?? null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT, server };
      finish({ success: true, port: HTTP_PORT, socksPort: SOCKS_PORT, server });
    });
  });
}

async function stop() {
  userStopped = true;
  if (xrayProcess) {
    xrayProcess.kill();
    xrayProcess = null;
  }
  stopHelper();
  status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
  try { fs.unlinkSync(getConfigPath()); } catch (_) {}
}

function getStatus() {
  return { ...status };
}

module.exports = { start, stop, getStatus, getLastKey, getLastServer, onUnexpectedExit, measureLatency };
