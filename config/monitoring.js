const fs = require('fs');
const path = require('path');
const { getUserDataPath, nodeEnv } = require('./appConfig');

function getLogDirectory() {
  const logRoot = process.env.MZ_LOG_DIR || path.join(getUserDataPath(), 'logs');
  fs.mkdirSync(logRoot, { recursive: true });
  return logRoot;
}

function writeLog(level, message) {
  const logDirectory = getLogDirectory();
  const timestamp = new Date().toISOString();
  const logFile = path.join(logDirectory, 'app.log');
  const line = `[${timestamp}] ${level.toUpperCase()} ${message}\n`;

  try {
    fs.appendFileSync(logFile, line, 'utf8');
  } catch (error) {
    console.error('[monitoring] Unable to write log entry:', error.message);
  }
}

function logInfo(message) {
  writeLog('info', message);
  if (nodeEnv !== 'test') {
    console.log(`[INFO] ${message}`);
  }
}

function logWarn(message) {
  writeLog('warn', message);
  if (nodeEnv !== 'test') {
    console.warn(`[WARN] ${message}`);
  }
}

function logError(message) {
  writeLog('error', message);
  if (nodeEnv !== 'test') {
    console.error(`[ERROR] ${message}`);
  }
}

function startupHealthSummary({ host, port, localIp, appName }) {
  const summary = {
    appName,
    environment: nodeEnv,
    host,
    port,
    localIp,
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    startedAt: new Date().toISOString(),
  };

  logInfo(`Service started: ${JSON.stringify(summary)}`);
  return summary;
}

module.exports = {
  getLogDirectory,
  writeLog,
  logInfo,
  logWarn,
  logError,
  startupHealthSummary,
};
