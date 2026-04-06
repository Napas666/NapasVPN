/**
 * Downloads xray-core Windows x64 binary from GitHub releases on first launch.
 * Stores xray.exe in app.getPath('userData') so it persists across updates.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { app } = require('electron');

const XRAY_RELEASE_URL =
  'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip';

function getXrayDir() {
  return app.getPath('userData');
}

function getXrayExePath() {
  return path.join(getXrayDir(), 'xray.exe');
}

function isXrayInstalled() {
  return fs.existsSync(getXrayExePath());
}

/**
 * Downloads a file over HTTPS, following redirects.
 * Calls onProgress(receivedBytes, totalBytes) periodically.
 */
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl) => {
      https.get(currentUrl, { headers: { 'User-Agent': 'NapasVPN' } }, (res) => {
        // Follow redirects (GitHub releases redirect to CDN)
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
          doRequest(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} при загрузке xray`));
          return;
        }

        const total = parseInt(res.headers['content-length'] || '0', 10);
        let received = 0;
        const dest = fs.createWriteStream(destPath);

        res.on('data', (chunk) => {
          received += chunk.length;
          if (onProgress && total) onProgress(received, total);
        });

        res.pipe(dest);
        dest.on('finish', () => dest.close(resolve));
        dest.on('error', reject);
        res.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}

/**
 * Extracts xray.exe from the downloaded ZIP using PowerShell (built into Windows 10+).
 */
function extractZip(zipPath, destDir) {
  const ps = `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`;
  execSync(`powershell -NoProfile -Command "${ps}"`);
}

/**
 * Main function: ensures xray.exe is present.
 * Returns { alreadyInstalled: true } immediately if already present,
 * otherwise downloads, extracts, and returns { alreadyInstalled: false }.
 * Calls onProgress(percent: 0-100, message: string) during download.
 */
async function ensureXray(onProgress) {
  if (isXrayInstalled()) {
    return { alreadyInstalled: true, path: getXrayExePath() };
  }

  if (process.platform !== 'win32') {
    // In development on macOS — skip download, expect assets/xray.exe
    return { alreadyInstalled: false, path: getXrayExePath(), skipped: true };
  }

  const zipPath = path.join(getXrayDir(), 'xray-tmp.zip');

  onProgress?.(0, 'Загрузка xray-core...');

  await downloadFile(XRAY_RELEASE_URL, zipPath, (received, total) => {
    const pct = Math.round((received / total) * 80);
    onProgress?.(pct, `Загрузка... ${Math.round(received / 1024 / 1024 * 10) / 10} МБ`);
  });

  onProgress?.(80, 'Распаковка...');
  extractZip(zipPath, getXrayDir());

  onProgress?.(95, 'Установка завершена');

  // Cleanup zip
  try { fs.unlinkSync(zipPath); } catch (_) {}

  if (!isXrayInstalled()) {
    throw new Error('xray.exe не найден после распаковки. Попробуйте снова.');
  }

  onProgress?.(100, 'Готово');
  return { alreadyInstalled: false, path: getXrayExePath() };
}

module.exports = { ensureXray, getXrayExePath, isXrayInstalled };
