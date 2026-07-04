const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const PROFILE_FILE = () => path.join(app.getPath('userData'), 'profile.json');
const RECENT_FILES_FILE = () => path.join(app.getPath('userData'), 'recentFiles.json');
const MAX_RECENT = 10;

// Keep a global reference so the window isn't garbage-collected
let mainWindow = null;
let fileToOpen = null;
// File data prepared for the renderer to pull on mount (avoids IPC timing race)
let pendingFileInfo = null;

function loadRecentFiles() {
  try {
    const p = RECENT_FILES_FILE();
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return [];
  }
}

function addToRecentFiles(name, filePath) {
  try {
    let recent = loadRecentFiles().filter(r => r.filePath !== filePath);
    recent.unshift({ name, filePath });
    if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
    const p = RECENT_FILES_FILE();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(recent), 'utf8');
    app.addRecentDocument(filePath);
  } catch {
    // non-fatal
  }
}

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

  // Prepare any file passed at startup as pendingFileInfo so the renderer
  // can pull it via get-pending-file once React has mounted (avoids the race
  // where did-finish-load fires before the onOpenFile listener is registered).
  mainWindow.webContents.on('did-finish-load', () => {
    if (!fileToOpen) return;
    const ext = path.extname(fileToOpen).toLowerCase();
    try {
      if (IMAGE_EXTS.includes(ext)) {
        const args = app.isPackaged ? process.argv.slice(1) : process.argv.slice(2);
        const imagePaths = args.filter(arg => {
          const e = path.extname(arg).toLowerCase();
          return IMAGE_EXTS.includes(e) && fs.existsSync(arg);
        });
        const filePaths = imagePaths.length > 0 ? imagePaths : [fileToOpen];
        const images = filePaths.map(fp => ({
          name: path.basename(fp),
          data: fs.readFileSync(fp).toString('base64'),
        }));
        pendingFileInfo = { type: 'images', images };
      } else {
        const buffer = fs.readFileSync(fileToOpen);
        const name = path.basename(fileToOpen);
        pendingFileInfo = { type: 'pdf', name, data: buffer.toString('base64') };
        addToRecentFiles(name, fileToOpen);
      }
    } catch (err) {
      console.error('Failed to prepare pending file:', err);
    }
    fileToOpen = null;
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
      addToRecentFiles(name, filePath);
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

// IPC: Let the renderer pull a file that was pending at startup
ipcMain.handle('get-pending-file', () => {
  const info = pendingFileInfo;
  pendingFileInfo = null;
  return info;
});

// IPC: Get the list of recently opened files
ipcMain.handle('get-recent-files', () => loadRecentFiles());

// IPC: Open a file by path (used by recent-files list)
ipcMain.handle('open-recent-file', async (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const name = path.basename(filePath);
    addToRecentFiles(name, filePath);
    return { name, data: buffer.toString('base64') };
  } catch (err) {
    console.error('Failed to open recent file:', err);
    return null;
  }
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
  const name = path.basename(filePath);
  addToRecentFiles(name, filePath);
  return { name, data: buffer.toString('base64') };
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

// IPC: Encrypt a PDF with AES-256 via mupdf (Node.js native, unavailable in renderer)
ipcMain.handle('encrypt-pdf', async (_, base64Data, opts) => {
  try {
    const mupdf = require('mupdf');
    const { userPassword = '', ownerPassword = '', allowPrint = true, allowCopy = true } = opts;
    let p = -4;
    if (!allowPrint) p &= ~4;
    if (!allowCopy) p &= ~16;
    const bytes = Buffer.from(base64Data, 'base64');
    const doc = mupdf.PDFDocument.openDocument(bytes, 'application/pdf');
    const encOpts = ['encrypt=aes-256'];
    if (userPassword) encOpts.push(`user-password=${userPassword}`);
    encOpts.push(`owner-password=${ownerPassword || userPassword}`);
    encOpts.push(`permissions=${p}`);
    const out = doc.saveToBuffer(encOpts.join(','));
    return Buffer.from(out.asUint8Array()).toString('base64');
  } catch (err) {
    console.error('encrypt-pdf failed:', err);
    return null;
  }
});
