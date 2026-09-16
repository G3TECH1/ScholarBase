const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseAPI', {
  getStatus: () => ipcRenderer.invoke('license:get-status'),
  activateTrial: () => ipcRenderer.invoke('license:activate-trial'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate-key', key),
  quit: () => ipcRenderer.invoke('license:quit'),
});