const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vpnAPI', {
  connect:    (vlessKey) => ipcRenderer.invoke('vpn:connect', vlessKey),
  disconnect: ()         => ipcRenderer.invoke('vpn:disconnect'),
  getStatus:  ()         => ipcRenderer.invoke('vpn:status'),
  ping:       ()         => ipcRenderer.invoke('vpn:ping'),
  diagnostics:()         => ipcRenderer.invoke('vpn:diagnostics'),
  minimize:   ()         => ipcRenderer.send('window:minimize'),
  close:      ()         => ipcRenderer.send('window:close'),

  onDownloadProgress: (cb) => ipcRenderer.on('xray:download-progress', (_e, d) => cb(d)),
  onXrayReady:        (cb) => ipcRenderer.on('xray:ready',             (_e, d) => cb(d)),
  onXrayError:        (cb) => ipcRenderer.on('xray:download-error',    (_e, d) => cb(d)),

  // Auto-reconnect events
  onReconnecting:    (cb) => ipcRenderer.on('vpn:reconnecting',    (_e, d) => cb(d)),
  onReconnected:     (cb) => ipcRenderer.on('vpn:reconnected',     (_e, d) => cb(d)),
  onReconnectFailed: (cb) => ipcRenderer.on('vpn:reconnect-failed', (_e, d) => cb(d)),
});
