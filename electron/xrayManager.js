const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { generateXrayConfig } = require('./configGenerator');
const { getXrayExePath } = require('./xrayDownloader');

const SOCKS_PORT = 10808;
const HTTP_PORT  = 10809;

let xrayProcess = null;
let status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };

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
 * This is the real "is xray running" check.
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

async function start(vlessKey) {
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

    // Collect output from BOTH stdout and stderr
    const onData = (data) => { output += data.toString(); };
    xrayProcess.stdout?.on('data', onData);
    xrayProcess.stderr?.on('data', onData);

    // If xray crashes immediately
    xrayProcess.on('error', (err) => {
      xrayProcess = null;
      finish({ success: false, error: `Ошибка запуска xray:\n${err.message}` });
    });

    xrayProcess.on('exit', (code) => {
      xrayProcess = null;
      status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
      finish({
        success: false,
        error: `xray завершился (код ${code}).\n\nВывод:\n${output.slice(-600) || '(пусто)'}`,
      });
    });

    // 5. Give xray up to 6 seconds to open the port — that's the real test
    waitForPort(SOCKS_PORT, '127.0.0.1', 6000).then((portOpen) => {
      if (!portOpen) {
        // xray didn't open port — kill it and report
        xrayProcess?.kill();
        xrayProcess = null;
        finish({
          success: false,
          error: `xray запустился, но порт ${SOCKS_PORT} не открылся.\n\nВывод:\n${output.slice(-600) || '(пусто)'}`,
        });
        return;
      }

      // Port is open — success
      status = { connected: true, pid: xrayProcess?.pid ?? null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
      finish({ success: true, port: HTTP_PORT, socksPort: SOCKS_PORT });
    });
  });
}

async function stop() {
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

module.exports = { start, stop, getStatus };
