import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('tobiPlayer', {
  sendMessage: (message: string) => ipcRenderer.send('message', message),

  openDialog: async () => {
    const filePath = await ipcRenderer.invoke('open-dialog');
    console.log('open file', filePath);
    return filePath;
  },

  setAppTitle: (title) => {
    ipcRenderer.send('set-app-title', title);
  },

  loadAudioFile: async (filePath) => {
    const audioUrl = await ipcRenderer.invoke('load-audio-file', filePath);
    return audioUrl;
  },

  createTranscript: async (filePath) => {
    const transcript = await ipcRenderer.invoke('create-transcript', filePath);
    return transcript;
  },
});