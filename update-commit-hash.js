const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 [Build-Info] Démarrage de l\'injection des informations de build...');

try {
  // 1. Récupération du commit hash
  let commitId;
  
  if (process.env.AWS_COMMIT_ID) {
    // Build Amplify : utiliser la variable d'environnement
    commitId = process.env.AWS_COMMIT_ID;
    console.log(`📌 Build Amplify détecté`);
  } else {
    // Build local : récupérer depuis Git
    try {
      commitId = execSync('git rev-parse HEAD').toString().trim();
      console.log(`📌 Build local détecté`);
    } catch (e) {
      throw new Error('Impossible de récupérer le commit Git: ' + e.message);
    }
  }

  // 2. Construire l'objet buildInfo
  const buildInfo = {
    commitHash: commitId.substring(0, 7),
    buildTimestamp: new Date().toISOString()
  };

  // 3. Chemin du fichier JSON
  const jsonPath = path.join(__dirname, 'projects', 'admin', 'src', 'environments', 'commitHash.json');

  // 4. Lire le contenu actuel (s'il existe)
  let currentContent = null;
  try {
    currentContent = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch {
    currentContent = null;
  }

  // 5. Vérifier si le hash a changé
  if (currentContent && currentContent.commitHash === buildInfo.commitHash) {
    console.log(`ℹ️  [Build-Info] Pas de changement : commit déjà ${buildInfo.commitHash}`);
    process.exit(0);
  }

  // 6. Écrire le JSON seulement s'il y a un changement
  const jsonString = JSON.stringify(buildInfo, null, 2) + '\n';
  fs.writeFileSync(jsonPath, jsonString, 'utf8');

  console.log(`✅ [Build-Info] commitHash.json mis à jour`);
  console.log(`   Hash: ${buildInfo.commitHash}`);
  console.log(`   Timestamp: ${buildInfo.buildTimestamp}`);
} catch (error) {
  console.error('❌ [Build-Info] Erreur:', error.message);
  process.exit(1);
}
