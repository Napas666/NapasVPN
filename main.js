const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Dispatches vless → xray (system proxy) and ss/ssconf → TUN (sing-box + Outline
// prefix helper). Same interface as the old xrayManager.
const xrayManager = require('./electron/connectionManager');
const proxyManager = require('./electron/proxyManager');
const { ensureXray } = require('./electron/xrayDownloader');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    resizable: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'build', 'index.html'));
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  // After window is ready — check/download xray
  mainWindow.webContents.once('did-finish-load', () => {
    ensureXray((percent, message) => {
      mainWindow?.webContents.send('xray:download-progress', { percent, message });
    })
    .then((result) => {
      mainWindow?.webContents.send('xray:ready', { alreadyInstalled: result.alreadyInstalled });
    })
    .catch((err) => {
      mainWindow?.webContents.send('xray:download-error', { error: err.message });
    });
  });
}

// ── Auto-reconnect ────────────────────────────────────────────────────────────

let isReconnecting = false;
let stopReconnect  = false;   // set to true when user manually disconnects
const MAX_RECONNECT = 3;

xrayManager.onUnexpectedExit(async () => {
  if (isReconnecting) return;
  const key = xrayManager.getLastKey();
  if (!key) return;

  isReconnecting  = true;
  stopReconnect   = false;

  for (let attempt = 1; attempt <= MAX_RECONNECT; attempt++) {
    if (stopReconnect) break;

    mainWindow?.webContents.send('vpn:reconnecting', { attempt, max: MAX_RECONNECT });

    // Wait 3 s, but bail early if user disconnected
    await new Promise((r) => setTimeout(r, 3000));
    if (stopReconnect) break;

    try {
      const result = await xrayManager.start(key);
      if (stopReconnect) {
        // User disconnected while start() was running — clean up
        await xrayManager.stop();
        await proxyManager.disable();
        break;
      }
      if (result.success) {
        // TUN mode captures traffic device-wide — no system proxy needed.
        if (result.mode !== 'tun' && result.port) await proxyManager.enable(result.port);
        isReconnecting = false;
        // Pass result so the renderer can restore serverInfo
        mainWindow?.webContents.send('vpn:reconnected', result);
        return;
      }
    } catch (_) {}
  }

  isReconnecting = false;
  if (!stopReconnect) {
    mainWindow?.webContents.send('vpn:reconnect-failed');
  }
});

// ── IPC handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('vpn:connect', async (_event, vlessKey) => {
  try {
    const result = await xrayManager.start(vlessKey);
    if (result.success && result.mode !== 'tun' && result.port) {
      await proxyManager.enable(result.port);
    }
    return result;
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vpn:disconnect', async () => {
  stopReconnect = true;   // abort any running reconnect loop
  try {
    await xrayManager.stop();
    await proxyManager.disable();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('vpn:status', () => xrayManager.getStatus());

// TCP ping to the VPN server (measures actual network latency)
ipcMain.handle('vpn:ping', async () => {
  // Host/port приходят из резолвнутого ключа (работает и для vless://, и для ss(conf)://)
  const server = xrayManager.getLastServer();
  if (!server) return { ms: -1, ok: false };
  return xrayManager.measureLatency(server.host, server.port);
});

// Gather full diagnostics, save to the Desktop, and return the text so the
// renderer can also copy it to the clipboard.
ipcMain.handle('vpn:diagnostics', async () => {
  const text = xrayManager.getDiagnostics ? xrayManager.getDiagnostics() : '(нет данных)';
  let savedPath = null;
  try {
    const dir = app.getPath('desktop');
    savedPath = path.join(dir, 'napasvpn-diagnostics.txt');
    require('fs').writeFileSync(savedPath, text, 'utf-8');
  } catch (_) {}
  return { text, savedPath };
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:close', async () => {
  await xrayManager.stop();
  await proxyManager.disable();
  app.quit();
});

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Сбрасываем прокси сразу при старте — на случай если прошлая сессия
// завершилась аварийно и оставила прокси включённым
proxyManager.disable().catch(() => {});

app.whenReady().then(createWindow);

// before-quit не ждёт async — используем event.preventDefault() чтобы
// дождаться полной очистки прежде чем Electron закроется
let _quitting = false;
app.on('before-quit', (event) => {
  if (_quitting) return;
  event.preventDefault();
  _quitting = true;
  Promise.allSettled([xrayManager.stop(), proxyManager.disable()])
    .finally(() => app.quit());
});

app.on('window-all-closed', () => {
  app.quit();
});
