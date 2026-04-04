/**
 * Crée des junctions Windows pour rendre @aws-amplify/backend
 * visible depuis amplify/node_modules, après chaque npm install.
 *
 * Contexte: npm workspaces hoise @aws-amplify/backend vers node_modules racine,
 * mais ampx (Amplify CLI) cherche les packages dans amplify/node_modules
 * sur Windows (TypeScript moduleResolution ne remonte pas).
 *
 * Sur Linux/macOS: npm workspaces fonctionne correctement, ce script ne fait rien.
 */

// Junctions are a Windows-only workaround — skip on Linux/macOS (CI, etc.)
if (process.platform !== 'win32') {
  process.exit(0);
}

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const packages = ['backend', 'backend-cli'];

const amplifyDir = path.join(root, 'amplify', 'node_modules', '@aws-amplify');
fs.mkdirSync(amplifyDir, { recursive: true });

for (const pkg of packages) {
  const src = path.join(root, 'node_modules', '@aws-amplify', pkg);
  const dst = path.join(amplifyDir, pkg);

  if (!fs.existsSync(src)) {
    console.warn(`[link-amplify-deps] Source not found: ${src}`);
    continue;
  }

  if (fs.existsSync(dst)) {
    // Already linked — nothing to do
    continue;
  }

  try {
    // 'junction' works on Windows without admin rights; on Linux it falls back to dir symlink
    fs.symlinkSync(src, dst, 'junction');
    console.log(`[link-amplify-deps] Linked @aws-amplify/${pkg}`);
  } catch (e) {
    console.warn(`[link-amplify-deps] Could not link @aws-amplify/${pkg}:`, e.message);
  }
}
