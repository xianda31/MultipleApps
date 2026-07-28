const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 [Git-Commit-Hook] Démarrage de l\'injection du commit...');

try {
  // 1. Récupération du hash Git
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  console.log(`📌 [Git-Commit-Hook] Hash détecté : ${hash}`);

  // 2. Dossier contenant les environnements Angular
  const envFile = path.join(__dirname, 'projects', 'admin', 'src', 'environments', 'commitHash.json');

  if (!fs.existsSync(envFile)) {
    console.error(`❌ [Git-Commit-Hook] Erreur: Le fichier ${envFile} n'existe pas.`);
    process.exit(1);
  }

 
  // 3. Écrit proprement le JSON
  const jsonPath = path.join(__dirname, 'projects', 'admin', 'src', 'environments', 'commitHash.json');
  const jsonContent = JSON.stringify({ commitHash: hash }, null, 2);
  fs.writeFileSync(jsonPath, jsonContent, 'utf8');

  console.log(`✅ [Git-Build] commitHash.json mis à jour avec le commit : ${hash}`);
} catch (error) {
  console.error('❌ [Git-Build] Impossible de récupérer le commit Git, utilisation de la valeur par défaut.');
}
