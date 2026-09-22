const fs = require('fs');
const path = require('path');

function runObfuscation() {
  const assetsDir = path.join(process.cwd(), 'dist', 'assets');
  if (!fs.existsSync(assetsDir)) {
    console.log('⚠️ dist/assets directory not found. Skipping obfuscation.');
    return;
  }

  let JavaScriptObfuscator;
  try {
    JavaScriptObfuscator = require('javascript-obfuscator');
  } catch (err) {
    console.log('ℹ️ Note: javascript-obfuscator runtime loader skipped (' + err.message + '). Vite production minification and esbuild drop-console protection remain active.');
    return;
  }

  console.log('🛡️ Starting Anti-Reverse Engineering & Security Obfuscation on dist/assets...');

  try {
    const files = fs.readdirSync(assetsDir);
    let obfuscatedCount = 0;

    for (const file of files) {
      if (file.endsWith('.js')) {
        const filePath = path.join(assetsDir, file);
        const originalCode = fs.readFileSync(filePath, 'utf8');
        
        // Skip very tiny files or source maps
        if (originalCode.length < 500) continue;

        try {
          const obfuscationResult = JavaScriptObfuscator.obfuscate(originalCode, {
            compact: true,
            controlFlowFlattening: true,
            controlFlowFlatteningThreshold: 0.3,
            deadCodeInjection: false, // Keep size minimal
            debugProtection: false, // Avoid blocking dev
            disableConsoleOutput: true,
            identifierNamesGenerator: 'mangled',
            log: false,
            numbersToExpressions: true,
            renameGlobals: false,
            selfDefending: false,
            simplify: true,
            splitStrings: true,
            splitStringsChunkLength: 10,
            stringArray: true,
            stringArrayCallsTransform: true,
            stringArrayEncoding: ['base64'],
            stringArrayIndexShift: true,
            stringArrayRotate: true,
            stringArrayShuffle: true,
            stringArrayWrappersCount: 2,
            stringArrayWrappersType: 'variable',
            stringArrayThreshold: 0.75,
            transformObjectKeys: false,
            unicodeEscapeSequence: false
          });

          fs.writeFileSync(filePath, obfuscationResult.getObfuscatedCode(), 'utf8');
          obfuscatedCount++;
          console.log(`  ✅ Hardened & Obfuscated: ${file}`);
        } catch (fileErr) {
          console.warn(`  ⚠️ Skipped ${file}:`, fileErr.message);
        }
      }
    }

    console.log(`🛡️ Security hardening complete. Obfuscated ${obfuscatedCount} bundle(s) successfully.`);
  } catch (globalErr) {
    console.warn('⚠️ Obfuscation encountered error, continuing build:', globalErr.message);
  }
}

try {
  runObfuscation();
} catch (e) {
  console.log('⚠️ Obfuscation wrapper safe exit:', e.message);
}
