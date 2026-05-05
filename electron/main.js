/**
 * Electron main process — Caisse WisePad 3
 *
 * Lance l'app Angular (dist/admin) dans une BrowserWindow.
 * Bluetooth LE est accessible car Chromium embarqué a les permissions
 * natives Windows — contrairement au Chrome web qui bloque le BT.
 */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// Activer Web Bluetooth (désactivé par défaut dans Electron)
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Caisse — Admin',
    webPreferences: {
      nodeIntegration: false,        // sécurité : pas d'accès Node dans Angular
      contextIsolation: true,        // sécurité : isolation du contexte
      sandbox: false,                // requis pour Web Bluetooth
    },
  });

  // Charger l'app Angular buildée
  const indexPath = path.join(__dirname, '..', 'dist', 'admin', 'browser', 'index.html');
  win.loadFile(indexPath);

  // En dev uniquement : ouvrir DevTools
  if (process.env['NODE_ENV'] === 'development') {
    win.webContents.openDevTools();
  }
}

// Autoriser les requêtes Web Bluetooth (permission handler)
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'bluetooth') {
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
