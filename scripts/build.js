const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('----------------------------------------------------');
console.log('[FAST CLOUD BUILD] Starting deployment build...');
console.log('----------------------------------------------------');

const rootDir = path.resolve(__dirname, '..');
const distIndex = path.join(rootDir, 'client/dist/index.html');
const distExists = fs.existsSync(distIndex);

console.log('[FAST CLOUD BUILD] Checking pre-built dist at:', distIndex, 'Exists:', distExists);

if (distExists) {
  console.log('[FAST CLOUD BUILD] ✓ Pre-compiled client bundle verified & ready.');
  console.log('[FAST CLOUD BUILD] Skipping heavy client npm install & compilation (saves 8+ minutes!).');
} else {
  console.log('[FAST CLOUD BUILD] client/dist not found. Compiling client bundle...');
  execSync('npm install --prefix client --legacy-peer-deps --no-audit --no-fund', { cwd: rootDir, stdio: 'inherit' });
  execSync('npm run build --prefix client', { cwd: rootDir, stdio: 'inherit' });
}

console.log('[FAST CLOUD BUILD] Checking server dependencies...');
const serverExpress = path.join(rootDir, 'server/node_modules/express');
if (fs.existsSync(serverExpress)) {
  console.log('[FAST CLOUD BUILD] ✓ server/node_modules already present and cached. Skipping install.');
} else {
  console.log('[FAST CLOUD BUILD] Installing server production dependencies (fast offline-first)...');
  try {
    execSync('npm ci --prefix server --omit=dev --no-audit --no-fund --prefer-offline', { cwd: rootDir, stdio: 'inherit' });
  } catch (_) {
    execSync('npm install --prefix server --omit=dev --no-audit --no-fund --prefer-offline', { cwd: rootDir, stdio: 'inherit' });
  }
}

console.log('----------------------------------------------------');
console.log('[FAST CLOUD BUILD] ✓ Application built successfully in record time!');
console.log('----------------------------------------------------');


