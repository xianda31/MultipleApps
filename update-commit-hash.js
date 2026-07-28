const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 [Build-Info] Démarrage de l\'injection des informations de build...');

try {
  // 1. Récupération des infos Git/Amplify
  const isAmplifyBuild = !!process.env.AWS_COMMIT_ID;
  
  let commitId, commitMessage, branch, commitAuthor, buildNumber;
  
  if (isAmplifyBuild) {
    // Build Amplify : utiliser les variables d'environnement
    commitId = process.env.AWS_COMMIT_ID;
    commitMessage = process.env.AWS_COMMIT_MESSAGE || 'N/A';
    branch = process.env.AWS_BRANCH || 'unknown';
    commitAuthor = process.env.AWS_COMMIT_AUTHOR || 'N/A';
    buildNumber = process.env.AWS_BUILD_NUMBER || null;
    console.log(`📌 Build Amplify détecté (Build #${buildNumber})`);
  } else {
    // Build local : récupérer depuis Git
    try {
      commitId = execSync('git rev-parse HEAD').toString().trim();
      commitMessage = execSync('git log -1 --pretty=%B').toString().trim();
      branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
      commitAuthor = execSync('git log -1 --pretty=%an').toString().trim();
      buildNumber = null; // Pas de build number en local
      console.log(`📌 Build local détecté`);
    } catch (e) {
      throw new Error('Impossible de récupérer les infos Git: ' + e.message);
    }
  }

  // 2. Construire l'objet buildInfo
  const buildInfo = {
    commitHash: commitId.substring(0, 7), // Hash court (7 chars)
    commitHashFull: commitId,              // Hash complet
    commitMessage: commitMessage,
    branch: branch,
    author: commitAuthor,
    buildNumber: buildNumber,              // Numéro de déploiement Amplify
    buildTimestamp: new Date().toISOString(),
    environment: isAmplifyBuild ? 'amplify' : 'local'
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

  // 5. Vérifier si le hash a changé (comparaison du hash complet uniquement)
  if (currentContent && currentContent.commitHashFull === commitId) {
    console.log(`ℹ️  [Build-Info] Pas de changement : commit déjà ${commitId.substring(0, 7)}`);
    process.exit(0);
  }

  // 6. Écrire le JSON seulement s'il y a un changement
  const jsonString = JSON.stringify(buildInfo, null, 2) + '\n';
  fs.writeFileSync(jsonPath, jsonString, 'utf8');

  console.log(`✅ [Build-Info] buildInfo.json mis à jour`);
  console.log(`   Hash: ${buildInfo.commitHash}`);
  console.log(`   Message: ${buildInfo.commitMessage.substring(0, 50)}...`);
  console.log(`   Branch: ${buildInfo.branch}`);
  console.log(`   Author: ${buildInfo.author}`);
} catch (error) {
  console.error('❌ [Build-Info] Erreur:', error.message);
  process.exit(1);
}
