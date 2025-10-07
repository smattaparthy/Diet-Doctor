import { app, BrowserWindow, Menu, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';

// Security settings
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let mainWindow: BrowserWindow | null = null;

// Window configuration
const createWindow = (): void => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
    icon: path.join(__dirname, 'assets/icon.png'),
    show: false, // Don't show until ready-to-show
    titleBarStyle: 'default',
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();

      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links securely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
};

// Security: Prevent navigation and new windows
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== 'http://localhost:3001' && !isDev) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers for secure communication
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('show-save-dialog', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'cultural-diet-data.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  return result.canceled ? null : result.filePath;
});

ipcMain.handle('show-open-dialog', async () => {
  if (!mainWindow) return null;

  const result = await dialog.showOpenDialog(mainWindow, {
    defaultPath: '.',
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  return result.canceled ? null : result.filePaths[0];
});

// Security: Set up proper menu
const template: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Import Data',
        accelerator: 'CmdOrCtrl+I',
        click: async () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('menu-import-data');
        }
      },
      {
        label: 'Export Data',
        accelerator: 'CmdOrCtrl+E',
        click: async () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('menu-export-data');
        }
      },
      { type: 'separator' },
      {
        label: process.platform === 'darwin' ? 'Quit CulturalDiet' : 'Exit',
        accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'Edit',
    submenu: [
      { role: 'undo', label: 'Undo' },
      { role: 'redo', label: 'Redo' },
      { type: 'separator' },
      { role: 'cut', label: 'Cut' },
      { role: 'copy', label: 'Copy' },
      { role: 'paste', label: 'Paste' },
      { role: 'selectAll', label: 'Select All' }
    ]
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload', label: 'Reload' },
      { role: 'forceReload', label: 'Force Reload' },
      { role: 'toggleDevTools', label: 'Toggle Developer Tools' },
      { type: 'separator' },
      { role: 'resetZoom', label: 'Reset Zoom' },
      { role: 'zoomIn', label: 'Zoom In' },
      { role: 'zoomOut', label: 'Zoom Out' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Toggle Full Screen' }
    ]
  },
  {
    label: 'Language',
    submenu: [
      {
        label: 'English',
        type: 'radio',
        checked: true,
        click: () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('language-change', 'en');
        }
      },
      {
        label: 'हिंदी (Hindi)',
        type: 'radio',
        click: () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('language-change', 'hi');
        }
      },
      {
        label: 'Español (Spanish)',
        type: 'radio',
        click: () => {
          if (!mainWindow) return;
          mainWindow.webContents.send('language-change', 'es');
        }
      }
    ]
  },
  {
    label: 'Help',
    submenu: [
      {
        label: 'About Cultural Diet',
        click: () => {
          if (!mainWindow) return;

          dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About Cultural Diet',
            message: 'Cultural Diet App',
            detail: 'Ayurvedic and Traditional Nutrition Management\n\nVersion ' + app.getVersion() + '\n\nHelping you maintain cultural dietary practices with modern convenience.',
            buttons: ['OK']
          });
        }
      }
    ]
  }
];

if (process.platform === 'darwin') {
  template.unshift({
    label: app.getName(),
    submenu: [
      { role: 'about', label: 'About ' + app.getName() },
      { type: 'separator' },
      { role: 'services', label: 'Services' },
      { type: 'separator' },
      { role: 'hide', label: 'Hide ' + app.getName() },
      { role: 'hideOthers', label: 'Hide Others' },
      { role: 'unhide', label: 'Show All' },
      { type: 'separator' },
      { role: 'quit', label: 'Quit ' + app.getName() }
    ]
  });

  // Window menu
  template[4].submenu = [
    { role: 'close', label: 'Close' },
    { role: 'minimize', label: 'Minimize' },
    { role: 'zoom', label: 'Zoom' },
    { type: 'separator' },
    { role: 'front', label: 'Bring All to Front' }
  ];
}

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

// Security: Already handled by setWindowOpenHandler above