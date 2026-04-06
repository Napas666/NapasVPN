const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpnAPI', {
  connect: (vlessKey) => ipcRenderer.invoke('vpn:connect', vlessKey),
  disconnect: () => ipcRenderer.invoke('vpn:disconnect'),
  getStatus: () => ipcRenderer.invoke('vpn:status'),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),

  onDownloadProgress: (cb) => ipcRenderer.on('xray:download-progress', (_e, data) => cb(data)),
  onXrayReady: (cb) => ipcRenderer.on('xray:ready', (_e, data) => cb(data)),
  onXrayError: (cb) => ipcRenderer.on('xray:download-error', (_e, data) => cb(data)),
});
