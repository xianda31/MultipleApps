#!/usr/bin/env node

/**
 * Copies PDF.js worker file to assets directory for development and production.
 * Solves "Could not read source map" errors by ensuring the worker is available.
 */

const fs = require('fs');
const path = require('path');

// PDF.js v4 uses ES modules (.mjs)
const sourceFile = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = path.join(__dirname, '..', 'projects', 'admin', 'src', 'assets');
const destFile = path.join(destDir, 'pdf.worker.min.mjs');

try {
  // Ensure destination directory exists
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log(`📁 Created directory: ${destDir}`);
  }

  // Copy file if source exists
  if (fs.existsSync(sourceFile)) {
    fs.copyFileSync(sourceFile, destFile);
    console.log(`✅ [PDF.js Worker] Copied pdf.worker.min.mjs to ${destFile}`);
  } else {
    console.warn(`⚠️  [PDF.js Worker] Source file not found: ${sourceFile}`);
    console.log(`   Checking alternative paths...`);
    
    // Try alternative location (older versions)
    const altSource = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
    if (fs.existsSync(altSource)) {
      fs.copyFileSync(altSource, destFile);
      console.log(`✅ [PDF.js Worker] Copied from alternative path to ${destFile}`);
    } else {
      console.error(`❌ [PDF.js Worker] Could not find pdf.worker.min.mjs in node_modules`);
      process.exit(1);
    }
  }
} catch (error) {
  console.error(`❌ [PDF.js Worker] Error:`, error.message);
  process.exit(1);
}
