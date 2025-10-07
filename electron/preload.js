const { contextBridge, ipcRenderer } = require('electron');

// Expose secure APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  version: () => ipcRenderer.invoke('app-version'),

  // File dialogs
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),

  // Menu actions
  onMenuAction: (callback) => {
    ipcRenderer.on('menu-import-data', callback);
    ipcRenderer.on('menu-export-data', callback);
  },

  onLanguageChange: (callback) => {
    ipcRenderer.on('language-change', callback);
  },

  // Remove listeners
  removeListeners: () => {
    ipcRenderer.removeAllListeners('menu-import-data');
    ipcRenderer.removeAllListeners('menu-export-data');
    ipcRenderer.removeAllListeners('language-change');
  }
});

// Security: Deny Node.js access
window.nodeRequire = undefined;
delete window.process;
delete window.Buffer;