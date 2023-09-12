const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tobiPlayer', {
  openDialog: async () => {
    const filePath = await ipcRenderer.invoke('open-dialog');
    return filePath;
  },
  setAppTitle: (title) => {
    ipcRenderer.send('set-app-title', title);
  }
});