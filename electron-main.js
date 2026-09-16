const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const licensing = require('./utils/licensing');

const isDev = !app.isPackaged;
const SERVER_PORT = process.env.PORT || 2000;

let pyProcess = null;
let licenseWindow = null;
let applicationStarted = false;

// 1. Resolve Python path (Dev script vs Production EXE)
function getPythonExecutablePath() {
  if (isDev) {
    return {
      command: process.env.PYTHON || 'python',
      args: [path.join(__dirname, 'model', 'inMemoryDB', 'database_server.py')]
    };
  } else {
    const exeName = process.platform === 'win32' ? 'db_service.exe' : 'db_service';
    return {
      command: path.join(process.resourcesPath, 'python_backend', exeName),
      args: []
    };
  }
}

// 2. Spawn Python DB Background Process
function spawnPythonDB() {
  const { command, args } = getPythonExecutablePath();

  pyProcess = spawn(command, args, {
    cwd: isDev 
      ? path.join(__dirname, 'model', 'inMemoryDB') 
      : path.join(process.resourcesPath, 'python_backend'),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  pyProcess.stdout.on('data', d => console.log(`[py-db] ${d}`));
  pyProcess.stderr.on('data', d => console.error(`[py-db-err] ${d}`));
  pyProcess.on('exit', (code) => console.log(`Python DB server exited with code ${code}`));
}

// 3. Start Express Server
function startExpressServer() {
  try {
    require(path.join(__dirname, 'app.js'));
  } catch (err) {
    console.error('Failed to start Express server:', err);
    dialog.showErrorBox('Express Startup Error', String(err));
  }
}

// 4. Create Main Desktop Window
function createDesktopWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    title: 'ScholarBase Schools DBMS',
  });

  mainWindow.loadURL(`http://127.0.0.1:${SERVER_PORT}/`);
  mainWindow.on('closed', () => app.quit());
}

// 5. Boot Application Services (Runs after License verification)
function startApplication() {
  if (applicationStarted) return;
  applicationStarted = true;

  try {
    spawnPythonDB();
  } catch (e) {
    dialog.showErrorBox('DB Startup Error', String(e));
  }

  startExpressServer();

  // Delay allows backend servers to bind local sockets before UI loads
  setTimeout(createDesktopWindow, 1500);
}

// 6. Create License / Trial Activation Window
function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 720,
    minHeight: 600,
    resizable: true,
    title: 'Activate ScholarBase',
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  licenseWindow.loadFile(path.join(__dirname, 'license.html'));
  licenseWindow.on('closed', () => { licenseWindow = null; });
}

// --- IPC Licensing Handlers ---
ipcMain.handle('license:get-status', () => licensing.getStatus());

ipcMain.handle('license:activate-trial', () => {
  const status = licensing.activateTrial();
  if (status.active) {
    if (licenseWindow) licenseWindow.close();
    startApplication();
  }
  return status;
});

ipcMain.handle('license:activate-key', (_event, key) => {
  const status = licensing.activateLicense(key);
  if (status.active) {
    if (licenseWindow) licenseWindow.close();
    startApplication();
  }
  return status;
});

ipcMain.handle('license:quit', () => app.quit());

// --- Application Lifecycle ---
app.whenReady().then(() => {
  const status = licensing.getStatus();
  if (status.active) {
    startApplication();
  } else {
    createLicenseWindow();
  }
});

app.on('before-quit', () => {
  if (pyProcess) pyProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
