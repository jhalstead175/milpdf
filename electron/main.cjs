const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const PROFILE_FILE = () => path.join(app.getPath('userData'), 'profile.json');

// Keep a global reference so the window isn't garbage-collected
let mainWindow = null;
let fileToOpen = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: 'MilPDF - PDF Editor',
    icon: path.join(__dirname, '..', 'public', 'milpdf.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server; in production, load the built files
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Once the renderer is ready, send any file that was passed via command line
  mainWindow.webContents.on('did-finish-load', () => {
    if (fileToOpen) {
      // Check if it's an image file
      const ext = path.extname(fileToOpen).toLowerCase();
      if (IMAGE_EXTS.includes(ext)) {
        // Collect all image files from initial args
        const args = app.isPackaged ? process.argv.slice(1) : process.argv.slice(2);
        const imageFiles = args.filter(arg => {
          const e = path.extname(arg).toLowerCase();
          return IMAGE_EXTS.includes(e) && fs.existsSync(arg);
        });
        sendImagesToRenderer(imageFiles.length > 0 ? imageFiles : [fileToOpen]);
      } else {
        sendFileToRenderer(fileToOpen);
      }
      fileToOpen = null;
    }
  });
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.webp', '.tiff', '.tif'];

function sendFileToRenderer(filePath) {
  if (!mainWindow) return;
  try {
    const buffer = fs.readFileSync(filePath);
    const name = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    if (IMAGE_EXTS.includes(ext)) {
      mainWindow.webContents.send('open-images', [{
        name,
        data: buffer.toString('base64'),
      }]);
    } else {
      mainWindow.webContents.send('open-file', {
        name,
        data: buffer.toString('base64'),
      });
    }
  } catch (err) {
    console.error('Failed to read file:', err);
  }
}

function sendImagesToRenderer(filePaths) {
  if (!mainWindow) return;
  try {
    const images = filePaths.map(fp => ({
      name: path.basename(fp),
      data: fs.readFileSync(fp).toString('base64'),
    }));
    mainWindow.webContents.send('open-images', images);
  } catch (err) {
    console.error('Failed to read image files:', err);
  }
}

// Extract file path from command-line args (skip electron exe and script)
function getFileFromArgs(argv) {
  // In packaged app argv[0] is the exe, in dev argv[0] is electron, argv[1] is script
  const args = app.isPackaged ? argv.slice(1) : argv.slice(2);
  const allExts = ['.pdf', ...IMAGE_EXTS];
  return args.find(arg => {
    const ext = path.extname(arg).toLowerCase();
    return allExts.includes(ext) && fs.existsSync(arg);
  }) || null;
}

// Windows/Linux: second-instance fires when another instance is launched (e.g. double-click a PDF)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const file = getFileFromArgs(argv);
    if (file) {
      // Check for multiple image files in args
      const args = app.isPackaged ? argv.slice(1) : argv.slice(2);
      const imageFiles = args.filter(arg => {
        const ext = path.extname(arg).toLowerCase();
        return IMAGE_EXTS.includes(ext) && fs.existsSync(arg);
      });
      if (imageFiles.length > 0) {
        sendImagesToRenderer(imageFiles);
      } else {
        sendFileToRenderer(file);
      }
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    fileToOpen = getFileFromArgs(process.argv);
    createWindow();
  });
}

// macOS: open-file event for file association
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) {
    sendFileToRenderer(filePath);
  } else {
    fileToOpen = filePath;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC: Let the renderer request a native file-open dialog
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const buffer = fs.readFileSync(filePath);
  return {
    name: path.basename(filePath),
    data: buffer.toString('base64'),
  };
});

// IPC: Let the renderer save a file via native dialog
ipcMain.handle('save-file-dialog', async (_event, { defaultName, data }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
  });
  if (result.canceled) return false;
  fs.writeFileSync(result.filePath, Buffer.from(data, 'base64'));
  return true;
});

ipcMain.handle('load-profile', () => {
  try {
    const filePath = PROFILE_FILE();
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error('Failed to load profile:', err);
    return '';
  }
});

ipcMain.handle('save-profile', (_event, data) => {
  try {
    const filePath = PROFILE_FILE();
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, data, 'utf8');
    return true;
  } catch (err) {
    console.error('Failed to save profile:', err);
    return false;
  }
});
