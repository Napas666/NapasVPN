const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

/**
 * Sets the Windows system HTTP/HTTPS proxy via registry (netsh doesn't touch
 * the IE/WinInet proxy which most apps respect).
 * This uses PowerShell to set the proxy in the registry.
 */

function psEscape(str) {
  return str.replace(/'/g, "''");
}

async function enable(httpPort = 10809) {
  if (process.platform !== 'win32') return; // skip on macOS in dev

  const proxyServer = `127.0.0.1:${httpPort}`;
  const ps = `
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 1;
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyServer -Value '${psEscape(proxyServer)}';
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyOverride -Value 'localhost;127.*;<local>';
`;
  try {
    await execAsync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`);
    // Notify WinInet of the change
    await execAsync(`powershell -NoProfile -Command "[System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy('http://${proxyServer}')"`).catch(() => {});
  } catch (err) {
    console.error('proxyManager.enable error:', err.message);
  }
}

async function disable() {
  if (process.platform !== 'win32') return;

  const ps = `
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings' -Name ProxyEnable -Value 0;
`;
  try {
    await execAsync(`powershell -NoProfile -Command "${ps.replace(/\n/g, ' ')}"`);
  } catch (err) {
    console.error('proxyManager.disable error:', err.message);
  }
}

module.exports = { enable, disable };
