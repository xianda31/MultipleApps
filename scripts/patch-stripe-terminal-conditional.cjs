#!/usr/bin/env node
// Runs the Stripe Terminal Android patch only on Windows.
// On Linux/macOS (CI, AWS CodeBuild) the patch is not needed.
const { execSync } = require('child_process');
const os = require('os');

if (os.platform() === 'win32') {
  console.log('Windows detected — running Stripe Terminal Android patch...');
  execSync(
    'powershell -ExecutionPolicy Bypass -File scripts/patch-stripe-terminal-android.ps1',
    { stdio: 'inherit' }
  );
} else {
  console.log(`Platform: ${os.platform()} — skipping Stripe Terminal Android patch (Windows only).`);
}
