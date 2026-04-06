const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { generateXrayConfig } = require('./configGenerator');
const { getXrayExePath } = require('./xrayDownloader');

const SOCKS_PORT = 10808;
const HTTP_PORT = 10809;

let xrayProcess = null;
let status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };

function getXrayPath() {
  // In dev on macOS: fall back to assets/
  const userDataPath = getXrayExePath();
  if (fs.existsSync(userDataPath)) return userDataPath;
  return path.join(__dirname, '..', 'assets', 'xray.exe');
}

function getConfigPath() {
  return path.join(os.tmpdir(), 'vpnet_config.json');
}

async function start(vlessKey) {
  if (xrayProcess) {
    await stop();
  }

  // Parse & generate config
  let config;
  try {
    config = generateXrayConfig(vlessKey, SOCKS_PORT, HTTP_PORT);
  } catch (err) {
    return { success: false, error: err.message };
  }

  // Write config to temp file
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  const xrayPath = getXrayPath();
  if (!fs.existsSync(xrayPath)) {
    return {
      success: false,
      error: `xray.exe не найден по пути: ${xrayPath}\nСкачайте xray-core и поместите xray.exe в папку assets/`,
    };
  }

  return new Promise((resolve) => {
    xrayProcess = spawn(xrayPath, ['run', '-config', configPath], {
      windowsHide: true,
    });

    let startupError = '';
    let resolved = false;

    // Give xray 2 seconds to start or fail
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (xrayProcess && xrayProcess.exitCode === null) {
          status = { connected: true, pid: xrayProcess.pid, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
          resolve({ success: true, port: HTTP_PORT, socksPort: SOCKS_PORT });
        } else {
          resolve({ success: false, error: startupError || 'xray не запустился' });
        }
      }
    }, 2000);

    xrayProcess.stderr.on('data', (data) => {
      const text = data.toString();
      startupError += text;
      // xray prints to stderr on success too, check for fatal
      if (text.includes('started') || text.includes('Xray') || text.includes('V2Ray')) {
        if (!resolved) {
          clearTimeout(timer);
          resolved = true;
          status = { connected: true, pid: xrayProcess.pid, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
          resolve({ success: true, port: HTTP_PORT, socksPort: SOCKS_PORT });
        }
      }
    });

    xrayProcess.on('error', (err) => {
      if (!resolved) {
        clearTimeout(timer);
        resolved = true;
        xrayProcess = null;
        status.connected = false;
        resolve({ success: false, error: `Ошибка запуска: ${err.message}` });
      }
    });

    xrayProcess.on('exit', (code) => {
      xrayProcess = null;
      status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };
      if (!resolved) {
        clearTimeout(timer);
        resolved = true;
        resolve({ success: false, error: startupError || `xray завершился с кодом ${code}` });
      }
    });
  });
}

async function stop() {
  if (xrayProcess) {
    xrayProcess.kill('SIGTERM');
    xrayProcess = null;
  }
  status = { connected: false, pid: null, socksPort: SOCKS_PORT, httpPort: HTTP_PORT };

  // Clean up temp config
  try {
    fs.unlinkSync(getConfigPath());
  } catch (_) {}
}

function getStatus() {
  return { ...status };
}

module.exports = { start, stop, getStatus };
