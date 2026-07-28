#!/usr/bin/env node

/**
 * Patches Amplify backend-output-schemas to add Zod record key schema.
 * This is a workaround for Zod validation issues with record types.
 * Works cross-platform (Windows, macOS, Linux).
 */

const fs = require('fs');
const path = require('path');

const schemaFiles = [
  'node_modules/@aws-amplify/backend-output-schemas/lib/platform/stack_metadata_schemas.js',
  'node_modules/@aws-amplify/deployed-backend-client/node_modules/@aws-amplify/backend-output-schemas/lib/platform/stack_metadata_schemas.js',
  'node_modules/@aws-amplify/backend-cli/node_modules/@aws-amplify/backend-output-schemas/lib/platform/stack_metadata_schemas.js',
];

let patchedCount = 0;

for (const filePath of schemaFiles) {
  const fullPath = path.join(process.cwd(), filePath);
  
  try {
    if (!fs.existsSync(fullPath)) {
      console.log(`⏭️  Skipped (not found): ${filePath}`);
      continue;
    }

    let content = fs.readFileSync(fullPath, 'utf-8');
    
    // Check if already patched
    if (content.includes('z.record(zod_1.z.string(),')) {
      console.log(`✅ Already patched: ${filePath}`);
      continue;
    }

    // Apply patch
    const originalPattern = /z\.record\(exports\.backendOutputEntryStackMetadataSchema\)/g;
    if (!originalPattern.test(content)) {
      console.log(`⚠️  Pattern not found in: ${filePath}`);
      continue;
    }

    const patched = content.replace(
      /z\.record\(exports\.backendOutputEntryStackMetadataSchema\)/g,
      'z.record(zod_1.z.string(), exports.backendOutputEntryStackMetadataSchema)'
    );

    fs.writeFileSync(fullPath, patched, 'utf-8');
    console.log(`✅ Patched: ${filePath}`);
    patchedCount++;
  } catch (error) {
    console.error(`❌ Error patching ${filePath}:`, error.message);
    process.exit(1);
  }
}

console.log(`\n✨ Patching complete! (${patchedCount} file(s) patched)`);
