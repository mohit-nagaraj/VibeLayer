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
    fullscreenable: false,      // avoid buggy compositor path
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

  stickerWindow.setIgnoreMouseEvents(true, { forward: true });
  stickerWindow.setContentProtection(true); 
  const managerWindow = new BrowserWindow({
    width: 900,
    height: 670,
    frame: false,
    x: 10,
    y: 10,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
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
