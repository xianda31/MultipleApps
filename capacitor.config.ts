import { CapacitorConfig } from '@capacitor/cli';

// DEV: commenter le bloc `server.url` pour le build de prod/déploiement APK
// LIVE RELOAD: décommenter `server.url` + lancer `ng serve admin --host 0.0.0.0`
//   puis `npx cap run android --target 2e03963c` (une seule fois pour déployer le shell)
const config: CapacitorConfig = {
  appId: 'fr.bridgeclubsaintorens.pptpe',
  appName: 'ppTPE',
  webDir: 'dist/pptpe/browser',
  server: {
    androidScheme: 'https',
    // DEV live reload : décommenter + lancer `ng serve pptpe --host 0.0.0.0`
    // url: 'http://192.168.1.130:4200',
    // cleartext: true,
  },
};

export default config;
