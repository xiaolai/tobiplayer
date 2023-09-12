const { app, BrowserWindow, ipcMain, dialog } = require('electron');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 350,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: __dirname + '/preload.js'
    }
  });

  mainWindow.loadFile('index.html');
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