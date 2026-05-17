/**
 * Electron main process — Caisse WisePad 3
 *
 * Lance l'app Angular (dist/admin) dans une BrowserWindow.
 * Bluetooth LE est accessible car Chromium embarqué a les permissions
 * natives Windows — contrairement au Chrome web qui bloque le BT.
 */

const { app, BrowserWindow, session } = require('electron');

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

  // Dev : pointe sur ng serve local ; prod (exe packagé) : URL de production
  const url = app.isPackaged
    ? 'https://bridgeclubsaintorens.fr/back'
    : 'http://localhost:4200/back';
  win.loadURL(url);

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
