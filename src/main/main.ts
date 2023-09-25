import { app, BrowserWindow, ipcMain, session, dialog } from 'electron';
import { join } from 'path';
import { readFileSync, writeFile } from 'fs';
import fs from 'fs';
import { exec} from 'child_process';

let mainWindow:any = null;

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 720,
    resizable: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  if (process.env.NODE_ENV === 'development') {
    const rendererPort = process.argv[2];
    // wider window to show dev tools in dev mode
    mainWindow.setSize(800, 600);
    // mainWindow.setSize(1300, 720);
    // mainWindow.setResizable(true);
    // mainWindow.webContents.openDevTools();
    mainWindow.loadURL(`http://localhost:${rendererPort}`);
  }
  else {
    mainWindow.loadFile(join(app.getAppPath(), 'renderer', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['script-src \'self\'']
      }
    })
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
});

ipcMain.on('message', (event, message) => {
  console.log(message);
});

ipcMain.handle('open-dialog', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav'] }
    ]
  });
  
  
  return result.filePaths[0];
});

ipcMain.on('set-app-title', (event, title) => {  // Check if 'mainWindow' is defined
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('load-audio-file', (event, filePath) => {
  try {
    const data = readFileSync(filePath)
    const audioBase64 = data.toString('base64');
    const audioUrl = 'data:audio/mp3;base64,' + audioBase64;
    return audioUrl;
  } catch (err) {
    console.error('Error reading audio file', err);
    return "";
  }
});

ipcMain.handle('create-transcript', (event, filePath) => {
  // if (filePath.endsWith('.mp3')) {
  //   return convertMp3ToWav(filePath)
  //     .then((wavFilePath) => {
  //       return transcribe(wavFilePath);
  //     })
  //     .then((transcript) => {
  //       deleteWavFile(filePath.replace('.mp3', '.wav'));
  //       return transcript;
  //     });
  // } else if (filePath.endsWith('.wav')) {
  //   return transcribe(filePath)
  //     .then((transcript) => {
  //       return transcript;
  //     });
  // }
  return transcribe(filePath)
      .then((transcript) => {
        return transcript;
      });
});

function convertMp3ToWav(filePath: string): Promise<string> {
  const wavfilePath = filePath.replace('.mp3', '.wav');

  return new Promise<string>((resolve, reject) => {
    const command = `ffmpeg -i "${filePath}" -ar 16000 -ac 1 -c:a pcm_s16le "${wavfilePath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(wavfilePath);
      }
    });
  });
};

function deleteWavFile(filePath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.unlink(filePath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

function transcribe(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // const sh = `./bin/main -m ./bin/ggml-base.en.bin -f "${filePath}" -otxt -of ./bin/output`
    // const sh = `./bin/main -m ./bin/ggml-base.en.bin -f "${filePath}" -otxt -of "${filePath.replace(/\..+$/, '')}"`
    const sh = `python3 ./src/py/stable-ts.py "${filePath}"`
    exec(sh, (err, stdout, stderr) => {
      if (err) {
        console.error(`exec error: ${err}`);
        return;
      }
      if (stderr) {
        console.error(`Error output: ${stderr}`);
      }
      console.log(`Output: ${stdout}`);

      // read the output file
      // const data = readFileSync(`${filePath.replace(/\..+$/, '.txt')}`);
      // const data = readFileSync(`${filePath.replace(/\..+$/, '.json')}`);
      // .replace(/\n */g, ' ')); // remove newlines in text
      // resolve(data.toString().trim().replace(/\n */g, ' '));
      // const transcriptHtml = convertJsonToHtml(`${filePath.replace(/\..+$/, '.json')}`);
      const data = JSON.parse(fs.readFileSync(`${filePath.replace(/\..+$/, '.json')}`, 'utf8'));

      // Create an empty array to store the HTML tags for each segment
      const htmlTags = [] as string[];

      // Iterate over each segment
      for (const segment of data.segments) {
        // Create an empty array to store the HTML tags for each word in the segment
        const segmentHtmlTags = [] as string[];

        // Iterate over each word in the segment
        for (const word of segment.words) {
          // Extract the word and its start/end positions
          const wordText = word.word;
          const start = word.start;
          const end = word.end;

          // Create the span tag with the appropriate attributes for each word
          const spanTag: string = `<word type="word" start="${start}" end="${end}">${wordText}</word>`;

          // Add the span tag to the array for the segment
          segmentHtmlTags.push(spanTag);
        }

        // Join the span tags with spaces to recreate the text for the segment
        const segmentHtmlText = segmentHtmlTags.join('');

        // Create the final HTML with the segment span tag and the text for the segment
        const segmentFinalHtml = `<segment start="${segment.start}" end="${segment.end}">${segmentHtmlText}</segment>`;

        // Add the final HTML for the segment to the array
        htmlTags.push(segmentFinalHtml);
      }

      // Join the final HTML for each segment with line breaks
      const finalHtml = htmlTags.join('');

      // Print the final HTML
      console.log(finalHtml);
      resolve(finalHtml);

    });
  });
};





