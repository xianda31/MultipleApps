const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 [Git-Commit-Hook] Démarrage de l\'injection du commit...');

try {
  // 1. Récupération du hash Git
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  console.log(`📌 [Git-Commit-Hook] Hash détecté : ${hash}`);

  // 2. Dossier contenant les environnements Angular
  const envDir = path.join(__dirname, 'projects', 'admin', 'src', 'environments');

  if (!fs.existsSync(envDir)) {
    console.error(`❌ [Git-Commit-Hook] Erreur: Le dossier ${envDir} n'existe pas.`);
    process.exit(1);
  }

  // 3. Lecture de tous les fichiers du dossier (environment.ts, environment.prod.ts, etc.)
  const files = fs.readdirSync(envDir);

  files.forEach(file => {
    // On ne traite que les fichiers TypeScript (.ts)
    if (file.endsWith('.ts')) {
      const filePath = path.join(envDir, file);
      let content = fs.readFileSync(filePath, 'utf8');

      if (content.includes('__COMMIT_HASH__')) {
        content = content.replace('__COMMIT_HASH__', hash);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ [Git-Commit-Hook] Commit injecté avec succès dans : ${file}`);
      } else {
        console.log(`ℹ️ [Git-Commit-Hook] Passé : ${file} (pas de placeholder __COMMIT_HASH__)`);
      }
    }
  });

} catch (error) {
  console.error('❌ [Git-Commit-Hook] Erreur lors de la récupération du commit Git :', error.message);
}
