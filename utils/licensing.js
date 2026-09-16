const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { machineIdSync } = require('node-machine-id');
const { getUserDataPath } = require('../config/appConfig');

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const LICENSE_FILE = 'license-state.json';

function getLicenseFilePath() {
  return path.join(getUserDataPath(), LICENSE_FILE);
}

function getHardwareId() {
  return crypto.createHash('sha256')
    .update(machineIdSync({ original: true }))
    .digest('hex');
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(getLicenseFilePath(), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') return null;
    return {};
  }
}

function writeState(state) {
  const filePath = getLicenseFilePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
}

function getStatus() {
  const now = Date.now();
  const state = readState();
  const hardwareId = getHardwareId();

  if (!state) return { active: false, reason: 'corrupt-state', hardwareId };

  const lastSeenAt = Number(state.lastSeenAt || 0);
  if (lastSeenAt && now + CLOCK_TOLERANCE_MS < lastSeenAt) {
    return { active: false, reason: 'clock-rollback', hardwareId };
  }

  if (state.license && state.license.hardwareId === hardwareId && now < Number(state.license.expiresAt)) {
    writeState({ ...state, lastSeenAt: Math.max(now, lastSeenAt) });
    return { active: true, type: 'license', expiresAt: Number(state.license.expiresAt), hardwareId };
  }

  if (state.trialStartedAt) {
    const expiresAt = Number(state.trialStartedAt) + TRIAL_DURATION_MS;
    if (now < expiresAt) {
      writeState({ ...state, lastSeenAt: Math.max(now, lastSeenAt) });
      return { active: true, type: 'trial', expiresAt, hardwareId };
    }
    return { active: false, reason: 'trial-expired', expiresAt, hardwareId };
  }

  return { active: false, reason: 'not-activated', hardwareId };
}

function activateTrial() {
  const currentStatus = getStatus();
  if (currentStatus.active || currentStatus.reason === 'clock-rollback') return currentStatus;

  const now = Date.now();
  writeState({ trialStartedAt: now, lastSeenAt: now });
  return getStatus();
}

function verifyLicenseKey(key) {
  if (typeof key !== 'string' || !key.trim()) return { valid: false, reason: 'missing-key' };

  const parts = key.trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'SB1') return { valid: false, reason: 'invalid-format' };

  const secret = 'SCHOLARBASE_SECURE_2026_HMAC_SECRET_KEY!#';
  if (!secret) return { valid: false, reason: 'license-verification-unconfigured' };

  const expectedSignature = crypto.createHmac('sha256', secret).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (parts[2].length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(parts[2]), Buffer.from(expectedSignature))) {
    return { valid: false, reason: 'invalid-signature' };
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.hardwareId !== getHardwareId() || Number(payload.expiresAt) <= Date.now()) {
      return { valid: false, reason: 'key-not-valid-for-this-device' };
    }
    return { valid: true, payload };
  } catch (error) {
    return { valid: false, reason: 'invalid-payload' };
  }
}

function activateLicense(key) {
  const verification = verifyLicenseKey(key);
  if (!verification.valid) return { active: false, reason: verification.reason, hardwareId: getHardwareId() };

  writeState({ license: verification.payload, lastSeenAt: Date.now() });
  return getStatus();
}

module.exports = { activateLicense, activateTrial, getHardwareId, getStatus, verifyLicenseKey };