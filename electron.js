const { app, BrowserWindow, ipcMain, screen, Menu } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  // Disable default menu bar entirely to prevent inspection and menu tampering
  Menu.setApplicationMenu(null);

  const primaryDisplay = screen ? screen.getPrimaryDisplay() : null;
  const { width: screenWidth = 1366, height: screenHeight = 768 } = primaryDisplay ? primaryDisplay.workAreaSize : {};

  mainWindow = new BrowserWindow({
    width: Math.min(1366, screenWidth),
    height: Math.min(768, screenHeight),
    minWidth: 1024,
    minHeight: 700,
    center: true,
    show: false,
    frame: true,
    backgroundColor: '#05070e',
    icon: path.join(__dirname, 'public', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      devTools: false, // 🛡️ Hardened: DevTools disabled against reverse engineering
      allowRunningInsecureContent: true
    }
  });

  // Load compiled Vite index.html or dev server
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    // Standard maximize for desktop ERP/POS experience
    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
  });

  // 🛡️ Block DevTools if opened programmatically or via inspection
  mainWindow.webContents.on('devtools-opened', () => {
    if (!isDev) {
      mainWindow.webContents.closeDevTools();
    }
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('⚠️ Electron did-fail-load:', errorCode, errorDescription);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
      }
    }, 1000);
  });

  // 🛡️ Block inspection keyboard shortcuts in production
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!isDev) {
      if (
        input.key === 'F12' ||
        (input.control && input.shift && ['i', 'j', 'c'].includes(input.key.toLowerCase())) ||
        (input.control && input.key.toLowerCase() === 'u')
      ) {
        event.preventDefault();
      }
    }
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// 🚀 Listen for Login Success -> Dynamically Expand Window
ipcMain.on('login-success-expand-window', () => {
  if (mainWindow) {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(1024, 700);
    if (!mainWindow.isMaximized()) {
      mainWindow.maximize();
    }
    mainWindow.focus();
  }
});

ipcMain.on('expand-window', () => {
  if (mainWindow) {
    mainWindow.setResizable(true);
    mainWindow.setMinimumSize(1024, 700);
    mainWindow.maximize();
    mainWindow.focus();
  }
});

// Window basic controls IPC
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize-toggle', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) app.quit();
});

ipcMain.on('window-set-always-on-top', (_event, flag) => {
  if (mainWindow) mainWindow.setAlwaysOnTop(Boolean(flag));
});

// Hardware / Printer Handlers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    console.error('Error fetching printers:', err);
    return [];
  }
});

ipcMain.handle('print-thermal', async (_event, options = {}) => {
  if (!mainWindow) return false;
  try {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    if (options.html) {
      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);
      await new Promise(res => setTimeout(res, 300));
      printWin.webContents.print({
        silent: true,
        deviceName: options.deviceName || '',
        margins: { marginType: 'none' }
      }, (success, errorType) => {
        printWin.close();
      });
      return true;
    }
    return false;
  } catch (e) {
    console.error('Thermal print error:', e);
    return false;
  }
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

