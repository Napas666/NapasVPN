const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { EventEmitter } = require('events');
const { generateXrayConfig } = require('./configGenerator');
const { getXrayExePath } = require('./xrayDownloader');

const SOCKS_PORT = 10808;
const HTTP_PORT  = 10809;
const emitter = new EventEmitter();

let xrayProcess = null;
let status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
let lastVlessKey = null;
let userStopped = false;

function getXrayPath() {
  const userDataPath = getXrayExePath();
  if (fs.existsSync(userDataPath)) return userDataPath;
  return path.join(__dirname, '..', 'assets', 'xray.exe');
}

function getConfigPath() {
  return path.join(os.tmpdir(), 'napasvpn_config.json');
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

function onUnexpectedExit(cb) {
  emitter.on('unexpected-exit', cb);
}

async function start(vlessKey) {
  userStopped = false;
  lastVlessKey = vlessKey;
  if (xrayProcess) await stop();

  // 1. Parse & generate config
  let config;
  try {
    config = generateXrayConfig(vlessKey, SOCKS_PORT, HTTP_PORT);
  } catch (err) {
    return { success: false, error: `Ошибка разбора ключа:\n${err.message}` };
  }

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
      finish({ success: false, error: `Ошибка запуска xray:\n${err.message}` });
    });

    xrayProcess.on('exit', (code) => {
      // If we already resolved successfully, this is an unexpected crash
      const wasConnected = resolved;
      xrayProcess = null;
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
        finish({
          success: false,
          error: `xray запустился, но порт ${SOCKS_PORT} не открылся.\n\nВывод:\n${output.slice(-600) || '(пусто)'}`,
        });
        return;
      }

      status = { connected: true, pid: xrayProcess?.pid ?? null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
      finish({ success: true, port: HTTP_PORT, socksPort: SOCKS_PORT });
    });
  });
}

async function stop() {
  userStopped = true;
  if (xrayProcess) {
    xrayProcess.kill();
    xrayProcess = null;
  }
  status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
  try { fs.unlinkSync(getConfigPath()); } catch (_) {}
}

function getStatus() {
  return { ...status };
}

module.exports = { start, stop, getStatus, getLastKey, onUnexpectedExit, measureLatency };
