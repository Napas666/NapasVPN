const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const REG_PATH = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

function psEscape(str) {
  return str.replace(/'/g, "''");
}

function runPS(script) {
  // Collapse newlines, run non-interactively
  const cmd = script.trim().replace(/\r?\n\s*/g, ' ');
  return execAsync(`powershell -NoProfile -NonInteractive -Command "${cmd}"`);
}

async function enable(httpPort = 10809) {
  if (process.platform !== 'win32') return;

  const proxyServer = `127.0.0.1:${httpPort}`;
  try {
    await runPS(`
      Set-ItemProperty -Path '${psEscape(REG_PATH)}' -Name ProxyEnable  -Value 1;
      Set-ItemProperty -Path '${psEscape(REG_PATH)}' -Name ProxyServer  -Value '${psEscape(proxyServer)}';
      Set-ItemProperty -Path '${psEscape(REG_PATH)}' -Name ProxyOverride -Value 'localhost;127.*;::1;<local>';
    `);
  } catch (err) {
    console.error('proxyManager.enable error:', err.message);
  }
}

async function disable() {
  if (process.platform !== 'win32') return;

  try {
    // Fully remove proxy settings — not just disable, but delete the keys.
    // This ensures a crash or uninstall never leaves a broken proxy behind.
    await runPS(`
      Set-ItemProperty    -Path '${psEscape(REG_PATH)}' -Name ProxyEnable -Value 0;
      Remove-ItemProperty -Path '${psEscape(REG_PATH)}' -Name ProxyServer   -ErrorAction SilentlyContinue;
      Remove-ItemProperty -Path '${psEscape(REG_PATH)}' -Name ProxyOverride -ErrorAction SilentlyContinue;
    `);
  } catch (err) {
    console.error('proxyManager.disable error:', err.message);
  }
}

module.exports = { enable, disable };
