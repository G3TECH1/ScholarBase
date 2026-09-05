const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;
const SERVER_PORT = process.env.PORT || 2000;

let pyProcess = null;

/**
 * Resolve Python path for development vs production package
 */
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

function startExpressServer() {
  try {
    // Require app.js directly inside Electron's main process
    require(path.join(__dirname, 'app.js'));
  } catch (err) {
    console.error('Failed to start Express server:', err);
    dialog.showErrorBox('Express Startup Error', String(err));
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadURL(`http://localhost:${SERVER_PORT}/`);
}

app.on('ready', () => {
  try {
    spawnPythonDB();
  } catch (e) {
    dialog.showErrorBox('DB Startup Error', String(e));
  }

  startExpressServer();

  // Short delay to ensure servers bind to local sockets before launching UI
  setTimeout(() => {
    createWindow();
  }, 1000);
});

app.on('before-quit', () => {
  if (pyProcess) pyProcess.kill();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});