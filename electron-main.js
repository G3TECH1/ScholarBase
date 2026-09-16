const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const licensing = require('./utils/licensing');

let pythonProcess = null;
let licenseWindow = null;
let applicationStarted = false;

function startPythonBackend() {
  pythonProcess = spawn('python', [path.join(__dirname, 'model', 'inMemoryDB', 'database_server.py')]);
  pythonProcess.stdout.on('data', (data) => console.log(`[Python DB]: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`[Python DB Error]: ${data}`));
}

function createDesktopWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
    title: 'ScholarBase Schools DBMS',
  });
  mainWindow.loadURL('http://127.0.0.1:2000/');
  mainWindow.on('closed', () => app.quit());
}

function startApplication() {
  if (applicationStarted) return;
  applicationStarted = true;
  require('./app.js');
  startPythonBackend();
  setTimeout(createDesktopWindow, 1500);
}

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

ipcMain.handle('license:get-status', () => licensing.getStatus());
ipcMain.handle('license:activate-trial', () => {
  const status = licensing.activateTrial();
  if (status.active) {
    licenseWindow.close();
    startApplication();
  }
  return status;
});
ipcMain.handle('license:activate-key', (_event, key) => {
  const status = licensing.activateLicense(key);
  if (status.active) {
    licenseWindow.close();
    startApplication();
  }
  return status;
});
ipcMain.handle('license:quit', () => app.quit());

app.whenReady().then(() => {
  const status = licensing.getStatus();
  if (status.active) startApplication();
  else createLicenseWindow();
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});