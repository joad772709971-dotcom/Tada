const fs = require('fs');
const path = require('path');

console.log('🔧 Running Firestore Internal Assertion Patch...');

const firestoreDir = path.resolve(__dirname, '../node_modules/@firebase/firestore');

if (!fs.existsSync(firestoreDir)) {
  console.log('ℹ️ @firebase/firestore not found in node_modules, skipping patch.');
  process.exit(0);
}

let patchedCount = 0;

function patchFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Minified / ESM variant: this.ve -= 1, __PRIVATE_hardAssert(this.ve >= 0, 3241, { ve: this.ve });
  // Replace with safe clamp: this.ve = Math.max(0, this.ve - 1);
  content = content.replace(
    /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\s*\(\s*this\.ve\s*>=\s*0\s*,\s*3241\s*,\s*\{[^}]*\}\s*\)/g,
    'this.ve = Math.max(0, this.ve - 1)'
  );

  // 2. Unminified / Node variant:
  // this.pendingResponses -= 1;
  // hardAssert(this.pendingResponses >= 0, 0x0ca9, { pendingResponses: this.pendingResponses });
  content = content.replace(
    /this\.pendingResponses\s*-=\s*1\s*;\s*hardAssert\s*\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*0x0?ca9\s*,\s*\{[^}]*\}\s*\)\s*;/g,
    'this.pendingResponses = Math.max(0, this.pendingResponses - 1);'
  );

  // 3. Fallback generic pattern for pendingResponses decrement + hardAssert 0xca9
  content = content.replace(
    /this\.pendingResponses\s*-=\s*1;[\s\n]*hardAssert\(this\.pendingResponses\s*>=\s*0,\s*3241[^)]*\);/g,
    'this.pendingResponses = Math.max(0, this.pendingResponses - 1);'
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    patchedCount++;
    console.log(`✅ Successfully patched: ${path.relative(firestoreDir, filePath)}`);
  }
}

function walkDir(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) {
      patchFile(fullPath);
    }
  }
}

walkDir(firestoreDir);

// Skip cleaning .vite cache to prevent breaking running dev server sessions
console.log(`✨ Firestore patch complete. Patched ${patchedCount} files.`);
