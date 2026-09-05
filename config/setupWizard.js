const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');

const { setupConfigFile, getUserDataPath } = require('./appConfig');

const USR_DATA_DIR = getUserDataPath();
const SETUP_CONFIG_FILE = setupConfigFile;

/**
 * Check if the system has been initialized
 */
function isSystemInitialized() {
  return fs.existsSync(SETUP_CONFIG_FILE);
}

/**
 * Get setup configuration
 */
function getSetupConfig() {
  if (!isSystemInitialized()) return null;
  try {
    return JSON.parse(fs.readFileSync(SETUP_CONFIG_FILE, 'utf-8'));
  } catch (err) {
    console.error('[-] Error reading setup config:', err);
    return null;
  }
}

function generateRecoveryKey() {
  const raw = crypto.randomBytes(6).toString('hex').toUpperCase();
  return `MZ-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

/**
 * Hash password with SHA256
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}



/**
 * Verify password against hash
 */
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

/**
 * Initialize system with principal and admin credentials
 */
function initializeSystem(principalName, principalPassword, adminName, adminPassword) {
  try {
    const principalKey = generateRecoveryKey();
    const adminKey = generateRecoveryKey();

    const config = {
      initialized: true,
      initDate: new Date().toISOString(),
      principal: {
        name: principalName,
        passwordHash: hashPassword(principalPassword),
        recoveryKeyHash: hashPassword(principalKey)
      },
      admin: {
        name: adminName,
        passwordHash: hashPassword(adminPassword),
        recoveryKeyHash: hashPassword(adminKey)
      }
    };

    const configDir = path.dirname(SETUP_CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    fs.writeFileSync(SETUP_CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('[SETUP] System initialized successfully with recovery keys');
    
    // Return the raw plain keys so they can be shown to the user once
    return { success: true, principalKey, adminKey };
  } catch (err) {
    console.error('[-] Error initializing system:', err);
    return { success: false };
  }
}

/**
 * Middleware to require setup if not initialized, but skip /teacher routes
 */
function setupRequiredMiddleware(req, res, next) {
  // Skip setup check for teacher routes (they have their own authentication)
  if (req.path.startsWith('/teacher') || req.path === '/setup' || req.path.startsWith('/auth/')) {
    return next();
  }
  
  if (!isSystemInitialized()) {
    return res.redirect('/setup');
  }
  next();
}

/**
 * Middleware to verify master key (for principal or admin)
 */
function verifyMasterKeyMiddleware(role) {
  return (req, res, next) => {
    const masterKey = req.session.masterKey;
    if (!masterKey) {
      return res.status(403).json({ error: 'Unauthorized: Master key required' });
    }

    const config = getSetupConfig();
    if (!config) {
      return res.status(500).json({ error: 'System not initialized' });
    }

    const roleConfig = config[role];
    if (!verifyPassword(masterKey, roleConfig.passwordHash)) {
      return res.status(403).json({ error: 'Invalid master key' });
    }

    next();
  };
}

/**
 * Create setup routes
 */
function updatePrincipalName(newName) {
  const config = getSetupConfig();
  if (!config || !config.principal) return { success: false, message: 'Principal config not found.' };

  const trimmedName = String(newName || '').trim();
  if (!trimmedName) return { success: false, message: 'Principal name cannot be empty.' };

  config.principal.name = trimmedName;

  try {
    fs.writeFileSync(SETUP_CONFIG_FILE, JSON.stringify(config, null, 2));
    return { success: true, name: trimmedName };
  } catch (err) {
    console.error('[-] Error updating principal name:', err);
    return { success: false, message: 'Failed to update principal name.' };
  }
}

function createSetupRoutes(app) {
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());

  // GET setup page
  app.get('/setup', (req, res) => {
    // 1. If we just completed setup, show Step 2 (Key Reveal Screen)
    if (req.session.keys) {
      const keys = req.session.keys;
      delete req.session.keys; // Clear from session after reading so it's only shown once

      return res.render('setup-wizard.ejs', {
        keys: keys,
        success: '✓ System initialized successfully! Save your emergency keys below.',
        error: null
      });
    }


    if (isSystemInitialized()) {
      return res.redirect('/');
    }

    res.render('setup-wizard.ejs', {
      keys: null,
      success: req.session.success || null,
      error: req.session.error || null
    });

    delete req.session.success;
    delete req.session.error;
  });

  // Recovery route to reset forgotten passwords
  app.post('/auth/recover-password', (req, res) => {
    const { role, recoveryKey, newPassword } = req.body; // role: 'principal' or 'admin'

    if (!role || !recoveryKey || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const config = getSetupConfig();
    if (!config) {
      return res.status(500).json({ error: 'System not initialized.' });
    }

    const target = config[role.toLowerCase()];
    if (!target) {
      return res.status(400).json({ error: 'Invalid account role.' });
    }

    // Verify recovery key against stored recoveryKeyHash
    if (!verifyPassword(recoveryKey.trim(), target.recoveryKeyHash)) {
      return res.status(401).json({ error: 'Invalid Emergency Recovery Key.' });
    }

    // Key is valid -> Update password hash and save config file
    target.passwordHash = hashPassword(newPassword);
    
    try {
      fs.writeFileSync(SETUP_CONFIG_FILE, JSON.stringify(config, null, 2));
      return res.json({ success: true, message: `${role.toUpperCase()} password reset successfully!` });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update system settings.' });
    }
  });

  // POST setup - Initialize system
  app.post('/setup/initialize', (req, res) => {
    if (isSystemInitialized()) {
      return res.status(400).json({ error: 'System already initialized' });
    }

    const { principalName, principalPassword, adminName, adminPassword } = req.body;

    if (!principalName || !principalPassword || !adminName || !adminPassword) {
      req.session.error = 'All fields are required';
      return res.redirect('/setup');
    }

    if (principalPassword.length < 6 || adminPassword.length < 6) {
      req.session.error = 'Passwords must be at least 6 characters';
      return res.redirect('/setup');
    }

    const result = initializeSystem(principalName, principalPassword, adminName, adminPassword);

    if (result.success) {
      // Pass keys to session so they can be rendered in step 2
      req.session.keys = {
        principal: result.principalKey,
        admin: result.adminKey
      };
      res.redirect('/setup');
    } else {
      req.session.error = 'Failed to initialize system. Try again.';
      res.redirect('/setup');
    }
  });

  // Authentication endpoints
  app.post('/auth/principal-login', (req, res) => {
    const { password } = req.body;
    const config = getSetupConfig();

    if (!config) {
      return res.status(400).json({ error: 'System not initialized' });
    }

    if (verifyPassword(password, config.principal.passwordHash)) {
      req.session.masterKey = password;
      req.session.role = 'principal';
      req.session.userName = config.principal.name;
      return res.json({ success: true, redirect: '/principal' });
    }

    res.status(401).json({ error: 'Invalid principal password' });
  });

  app.post('/auth/admin-login', (req, res) => {
    const { password } = req.body;
    const config = getSetupConfig();

    if (!config) {
      return res.status(400).json({ error: 'System not initialized' });
    }

    if (verifyPassword(password, config.admin.passwordHash)) {
      req.session.masterKey = password;
      req.session.role = 'admin';
      req.session.userName = config.admin.name;
      return res.json({ success: true, redirect: '/admin' });
    }

    res.status(401).json({ error: 'Invalid admin password' });
  });

  // Logout
  app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      res.redirect('/');
    });
  });
}

module.exports = {
  isSystemInitialized,
  getSetupConfig,
  initializeSystem,
  hashPassword,
  verifyPassword,
  updatePrincipalName,
  setupRequiredMiddleware,
  verifyMasterKeyMiddleware,
  createSetupRoutes
};
