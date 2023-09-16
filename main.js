const { app, BrowserWindow, ipcMain, dialog } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 385,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: __dirname + '/preload.js'
    }
  });

  mainWindow.loadFile('./index.html');
  // mainWindow.webContents.openDevTools();
}



app.whenReady().then(createWindow);

ipcMain.handle('open-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav'] }
    ]
  });
  return result.filePaths[0];
});

ipcMain.on('set-app-title', (event, title) => {
  mainWindow.setTitle(title);
});
