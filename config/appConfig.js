const fs = require('fs');
const path = require('path');
const os = require('os');

function getUserDataPath() {
  if (process.versions && process.versions.electron) {
    try {
      const { app } = require('electron');
      if (app && typeof app.getPath === 'function') {
        return app.getPath('userData');
      }
    } catch (err) {
      console.warn('[-] Could not load Electron app module, falling back to OS path.');
    }
  }

  const appDataPath = process.env.APPDATA || (
    process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config')
  );

  return path.join(appDataPath, 'ScholarBase DBMS');
}

const nodeEnv = process.env.NODE_ENV || 'development';
const sessionSecret = process.env.SESSION_SECRET || 'mount-zion-school-secret-key';
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 2000);
const setupConfigFile = process.env.MZ_SETUP_CONFIG_FILE || path.join(getUserDataPath(), 'setup-config.json');

const isProduction = nodeEnv === 'production';

module.exports = {
  nodeEnv,
  isProduction,
  sessionSecret,
  host,
  port,
  setupConfigFile,
  getUserDataPath,
};
