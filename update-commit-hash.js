const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 [Git-Commit-Hook] Démarrage de l\'injection du commit...');

try {
  // 1. Récupération du hash Git
  const hash = execSync('git rev-parse --short HEAD').toString().trim();
  console.log(`📌 [Git-Commit-Hook] Hash détecté : ${hash}`);

  // 2. Chemin du fichier JSON
  const jsonPath = path.join(__dirname, 'projects', 'admin', 'src', 'environments', 'commitHash.json');

  if (!fs.existsSync(jsonPath)) {
    console.warn(`⚠️  [Git-Commit-Hook] Le fichier ${jsonPath} n'existe pas, création...`);
  }

  // 3. Lire le contenu actuel (s'il existe)
  let currentContent = null;
  try {
    currentContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    currentContent = null;
  }

  // 4. Vérifier si le hash a changé
  const newContent = { commitHash: hash };
  
  if (currentContent && currentContent.commitHash === hash) {
    console.log(`ℹ️  [Git-Build] Pas de changement : le hash est déjà ${hash}`);
    process.exit(0);
  }

  // 5. Écrire le JSON seulement s'il y a un changement
  const jsonString = JSON.stringify(newContent, null, 2) + '\n';
  fs.writeFileSync(jsonPath, jsonString, 'utf8');

  console.log(`✅ [Git-Build] commitHash.json mis à jour : ${hash}`);
} catch (error) {
  console.error('❌ [Git-Build] Erreur:', error.message);
  process.exit(1);
}
