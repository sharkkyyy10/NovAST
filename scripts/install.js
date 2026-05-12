const { execSync } = require('child_process');
const path = require('path');

const cwd = process.cwd();

// If we are running inside npm's temp cache directory during a git install,
// skip the build to avoid NPM's pacote large-file tarball EOF packing bug.
if (cwd.includes('_cacache') || cwd.includes('.npm/_npx')) {
  console.log('[NovAST] Detected NPM temp cache directory. Skipping native build during packing phase.');
  process.exit(0);
}

console.log('[NovAST] Compiling native Rust engine...');
try {
  // Use the local napi binary provided by @napi-rs/cli dependency
  execSync('npm run build:core', { stdio: 'inherit' });
  console.log('[NovAST] Native engine compiled successfully.');
} catch (err) {
  console.error('[NovAST] Native compilation failed:', err.message);
  process.exit(1);
}
