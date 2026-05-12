#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const coreDir = path.join(__dirname, '..', 'novast-core');

// Check if the native binary already exists in dist/
const nodeFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.node'));
if (nodeFiles.length > 0) {
  console.log('[NovAST] Native binary found. Skipping compilation.');
  process.exit(0);
}

// Check if Rust toolchain is available
try {
  execSync('rustc --version', { stdio: 'ignore' });
} catch {
  console.error('[NovAST] Rust toolchain not found. Install from https://rustup.rs');
  console.error('[NovAST] The CLI will not work without the native binary.');
  process.exit(0); // Exit clean so npm doesn't fail
}

// Check if novast-core source exists
if (!fs.existsSync(path.join(coreDir, 'Cargo.toml'))) {
  console.log('[NovAST] No Rust source found. Skipping native compilation.');
  process.exit(0);
}

console.log('[NovAST] Compiling native Rust engine...');
try {
  execSync('npx --yes @napi-rs/cli build --platform --release', {
    cwd: coreDir,
    stdio: 'inherit',
  });

  // Copy the compiled binary to dist/
  const compiled = fs.readdirSync(coreDir).filter(f => f.endsWith('.node'));
  for (const f of compiled) {
    fs.copyFileSync(path.join(coreDir, f), path.join(distDir, f));
  }
  console.log('[NovAST] Native engine compiled successfully.');
} catch (err) {
  console.error('[NovAST] Native compilation failed:', err.message);
  process.exit(0); // Exit clean
}
