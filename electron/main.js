/**
 * Electron main process — Caisse WisePad 3
 *
 * Lance l'app Angular (dist/admin) dans une BrowserWindow.
 * Bluetooth LE est accessible car Chromium embarqué a les permissions
 * natives Windows — contrairement au Chrome web qui bloque le BT.
 */

const { app, BrowserWindow, session, globalShortcut } = require('electron');

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

  // F12 pour toggle DevTools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      win.webContents.toggleDevTools();
    }
  });

  // Web Bluetooth (WisePad 3 BLE) : Electron bloque requestDevice() sans ce handler.
  // Le SDK Stripe Terminal appelle navigator.bluetooth.requestDevice() → Electron émet
  // select-bluetooth-device avec la liste des appareils trouvés pendant le scan.
  // On sélectionne automatiquement le WisePad 3 (ou le premier appareil si non identifié).
  win.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();

    const wisepad = deviceList.find(d => {
      const name = (d.deviceName || '').toLowerCase();
      return name.includes('wisepad') || name.includes('bbpos') || name.includes('wp3');
    });

    if (wisepad) {
      callback(wisepad.deviceId);
    } else if (deviceList.length > 0) {
      callback(deviceList[0].deviceId);
    }
    // Si liste vide : ne pas appeler callback → le scan BLE continue
  });

  // Gérer les demandes de couplage BLE (PIN/passkey) si nécessaire
  session.defaultSession.setBluetoothPairingHandler((details, callback) => {
    // WisePad 3 : confirmer le couplage sans PIN (Just Works)
    callback({ confirmed: true });
  });
}

// Autoriser les requêtes Web Bluetooth (permission handler)
app.whenReady().then(() => {
  // Vérification synchrone des permissions — REQUIS pour Web Bluetooth depuis URL distante.
  // Sans ce handler, requestDevice() échoue silencieusement avant même de scanner.
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    if (permission === 'bluetooth') {
      return true;
    }
    return null; // comportement par défaut pour les autres
  });

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
