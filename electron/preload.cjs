const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Listen for a file opened via OS file association / command line
  onOpenFile: (callback) => {
    ipcRenderer.on('open-file', (_event, fileInfo) => callback(fileInfo));
  },
  // Listen for images opened via OS context menu / command line
  onOpenImages: (callback) => {
    ipcRenderer.on('open-images', (_event, images) => callback(images));
  },
  // Request a native open-file dialog
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  // Request a native save-file dialog
  saveFileDialog: (defaultName, base64Data) =>
    ipcRenderer.invoke('save-file-dialog', { defaultName, data: base64Data }),
  // Check if running in Electron
  isElectron: true,
});
