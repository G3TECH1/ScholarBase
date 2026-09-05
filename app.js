const express = require('express');
const session = require('express-session');
const path = require('path');
const os = require('os');

const { sessionSecret, host, port, isProduction } = require('./config/appConfig');
const { startupHealthSummary, logInfo, logWarn } = require('./config/monitoring');
const studentRoutes = require('./routes/studentRoute');
const { createSetupRoutes, setupRequiredMiddleware, getSetupConfig } = require('./config/setupWizard');

const app = express();

// Helper to determine Local IP for mobile devices on LAN
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Session configuration
app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 3600000,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax'
  }
}));

// Create setup routes (including /setup and /auth endpoints)
createSetupRoutes(app);

// Flash Message Middleware
app.use((req, res, next) => {
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  delete req.session.success;
  delete req.session.error;
  next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// Setup middleware (skips teacher routes)
app.use(setupRequiredMiddleware);

// Home portal router
app.get('/', (req, res) => {
  res.render('index-login.ejs', { localIp: getLocalIpAddress() });
});

// All routes
app.use('/', studentRoutes);

app.listen(port, host, () => {
  const localIp = getLocalIpAddress();
  console.log(`=======================================================`);
  console.log(`🏫 ScholarBase Offline DBMS Running`);
  console.log(`💻 Local Machine: http://localhost:${port}`);
  console.log(`📱 Mobile LAN Teacher Portal: http://${localIp}:${port}/teacher`);
  console.log(`=======================================================`);

  startupHealthSummary({
    host,
    port,
    localIp,
    appName: 'ScholarBase School System',
  });

  logInfo(`HTTP server ready on ${host}:${port}`);
  logWarn('Deployment mode should use HTTPS, strict secrets management, and backup monitoring in production.');
});