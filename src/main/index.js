const { app, BrowserWindow, ipcMain, desktopCapturer, screen  } = require('electron')
const { join } = require('path')
const { electronApp, optimizer, is } = require('@electron-toolkit/utils')
const icon = join(__dirname, '../../resources/icon.png')
const fs = require('fs')
const path = require('path')
const Store = require('electron-store')
const AutoLaunch = require('auto-launch')

ipcMain.handle('DESKTOP_CAPTURER_GET_SOURCES', (e, opts) =>
  desktopCapturer.getSources(opts)
);

let stickerWindowRef = null;
function createWindows() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  const stickerWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width,
    height,
    // --- critical flags ---
    frame: false,
    // transparent: true,
    thickFrame: false,          // windows only
    // fullscreenable: false,      // avoid buggy compositor path
    fullscreen: true,
    backgroundColor: '#00000000',
    // --- behaviour flags you already had ---
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname,'../preload/index.js'),
      sandbox: false,
      webSecurity: false
    }
  });
  stickerWindowRef = stickerWindow;

  stickerWindow.setIgnoreMouseEvents(true, { forward: true });
  stickerWindow.setContentProtection(true); 
  const iconPath = is.dev
    ? join(__dirname, '../../resources/icon.png')
    : join(__dirname, '../../build/icon.png');

  const managerWindow = new BrowserWindow({
    width: 900,
    height: 670,
    frame: false,
    x: 10,
    y: 10,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    title: 'VibeLayer',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false 
    }
  });

  managerWindow.on('ready-to-show', () => {
    managerWindow.show();
  });
  managerWindow.setContentProtection(true);

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    stickerWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/sticker.html');
    managerWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/index.html');
  } else {
    stickerWindow.loadFile(join(__dirname, '../renderer/sticker.html'));
    managerWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }


  ipcMain.on('update-sticker-layout', (_, layout) => {
    console.log('Main received layout update:', layout);
    if (BrowserWindow.getAllWindows().length > 1) {
      const stickerWindow = BrowserWindow.getAllWindows().find(win => {
        const webContents = win.webContents;
        try {
          return win !== managerWindow;
        } catch (e) {
          return false;
        }
      });
      
      if (stickerWindow && !stickerWindow.isDestroyed()) {
        console.log('Main forwarding layout update to sticker window');
        stickerWindow.webContents.send('update-sticker-layout', layout);
      } else {
        console.error('Sticker window not found or destroyed');
      }
    } else {
        console.error('No other windows open to send layout to');
    }
  });

  // stickerWindow.webContents.openDevTools();
}

const stickersDir = path.join(app.getPath('userData'), 'stickers')
if (!fs.existsSync(stickersDir)) fs.mkdirSync(stickersDir)

const appLauncher = new AutoLaunch({ name: 'VibeLayer' })

const store = new (Store.default || Store)()

ipcMain.handle('save-sticker', async (_, { name, buffer }) => {
  const filePath = path.join(stickersDir, name)
  fs.writeFileSync(filePath, Buffer.from(buffer))
  return filePath
})
ipcMain.handle('list-stickers', async () => {
  return fs.readdirSync(stickersDir).map(name => ({
    name,
    path: path.join(stickersDir, name)
  }))
})
ipcMain.handle('delete-sticker', async (_, name) => {
  const filePath = path.join(stickersDir, name)
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  return true
})
ipcMain.handle('get-layout', () => store.get('layout', {}))
ipcMain.handle('set-layout', (_, layout) => { store.set('layout', layout); return true })
ipcMain.handle('get-settings', () => store.get('settings', {}))
ipcMain.handle('set-settings', (_, settings) => { store.set('settings', settings); return true })
ipcMain.handle('rename-sticker', async (_, { oldName, newName }) => {
  const oldPath = path.join(stickersDir, oldName)
  const newPath = path.join(stickersDir, newName)
  if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath)
  return true
})
ipcMain.handle('set-auto-launch', async (_, enable) => {
  if (enable) await appLauncher.enable()
  else await appLauncher.disable()
  return true
})
ipcMain.handle('get-auto-launch', async () => appLauncher.isEnabled())

ipcMain.handle('import-sticker-url', async (_, url) => {
  if (!url || typeof url !== 'string' || !url.trim()) {
    throw new Error('URL is empty or invalid');
  }
  try {
    const https = require('https');
    const http = require('http');
    const { extname } = require('path');
    const { v4: uuidv4 } = require('uuid');
    const validImageTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp'];
    const protocol = url.startsWith('https') ? https : http;
    
    // Download the image and validate content-type
    const fileBuffer = await new Promise((resolve, reject) => {
      protocol.get(url, (res) => {
        const contentType = res.headers['content-type'];
        if (!validImageTypes.includes(contentType)) {
          reject(new Error('URL does not point to a valid image.'));
          res.resume();
          return;
        }
        const ext = contentType.split('/')[1] || 'png';
        const data = [];
        res.on('data', chunk => data.push(chunk));
        res.on('end', () => resolve({ buffer: Buffer.concat(data), ext }));
      }).on('error', reject);
    });
    const name = `sticker_${Date.now()}_${Math.floor(Math.random()*10000)}.${fileBuffer.ext}`;
    const filePath = path.join(stickersDir, name);
    fs.writeFileSync(filePath, fileBuffer.buffer);
    return filePath;
  } catch (err) {
    throw new Error('Failed to import image from URL: ' + err.message);
  }
});

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))

  ipcMain.handle('is-sticker-window-fullscreen', () => {
    const stickerWindow = BrowserWindow.getAllWindows().find(win => win.webContents.getURL().includes('sticker.html'));
    return stickerWindow ? stickerWindow.isFullScreen() : false;
  });

  createWindows()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindows()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.handle('window-minimize', () => {
  const win = BrowserWindow.getAllWindows().find(w => w.isFocused());
  if (win) win.minimize();
});
ipcMain.handle('window-maximize', () => {
  const win = BrowserWindow.getAllWindows().find(w => w.isFocused());
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});
ipcMain.handle('window-close', () => {
  const win = BrowserWindow.getAllWindows().find(w => w.isFocused());
  if (win) win.close();
});

ipcMain.handle('set-sticker-content-protection', (_, value) => {
  if (stickerWindowRef && !stickerWindowRef.isDestroyed()) {
    stickerWindowRef.setContentProtection(!!value);
    return true;
  }
  return false;
});
