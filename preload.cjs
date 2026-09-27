const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  expandWindow: () => ipcRenderer.send('expand-window'),
  minimize: () => ipcRenderer.send('window-minimize'),
  toggleMaximize: () => ipcRenderer.send('window-maximize-toggle'),
  close: () => ipcRenderer.send('window-close'),
  setAlwaysOnTop: (flag) => ipcRenderer.send('window-set-always-on-top', flag),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printThermal: (options) => ipcRenderer.invoke('print-thermal', options),
  saveProtectedData: (key, data) => ipcRenderer.invoke('save-protected-data', { key, data }),
  saveExternalMirror: (storeId, key, data) => ipcRenderer.invoke('save-external-mirror', { storeId, key, data }),
  scanExternalMirrors: (storeId) => ipcRenderer.invoke('scan-external-mirrors', { storeId }),
};

const electronBridge = {
  ipcRenderer: {
    send: (channel, ...args) => ipcRenderer.send(channel, ...args),
    on: (channel, func) => ipcRenderer.on(channel, (event, ...args) => func(event, ...args)),
    once: (channel, func) => ipcRenderer.once(channel, (event, ...args) => func(event, ...args)),
    removeListener: (channel, func) => ipcRenderer.removeListener(channel, func),
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  },
  setAlwaysOnTop: (flag) => ipcRenderer.send('window-set-always-on-top', flag),
};

try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
  contextBridge.exposeInMainWorld('electron', electronBridge);
  contextBridge.exposeInMainWorld('isElectron', true);
} catch {
  // If context isolation is disabled fallback to direct window assignment
  window.electronAPI = electronAPI;
  window.electron = electronBridge;
  window.isElectron = true;
}
