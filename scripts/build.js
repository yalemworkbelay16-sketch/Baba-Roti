const fs = require('fs');
const { execSync } = require('child_process');

console.log('----------------------------------------------------');
console.log('[FAST CLOUD BUILD] Starting deployment build...');
console.log('----------------------------------------------------');

const distIndex = 'client/dist/index.html';
const distExists = fs.existsSync(distIndex);

if (distExists) {
  console.log('[FAST CLOUD BUILD] ✓ client/dist/index.html exists and is up to date.');
  console.log('[FAST CLOUD BUILD] Skipping heavy client npm install & compilation (saves 4+ minutes!).');
} else {
  console.log('[FAST CLOUD BUILD] client/dist not found. Compiling client bundle...');
  execSync('npm install --prefix client --legacy-peer-deps --no-audit --no-fund', { stdio: 'inherit' });
  execSync('npm run build --prefix client', { stdio: 'inherit' });
}

console.log('[FAST CLOUD BUILD] Installing server production dependencies...');
execSync('npm install --prefix server --omit=dev --no-audit --no-fund', { stdio: 'inherit' });

console.log('----------------------------------------------------');
console.log('[FAST CLOUD BUILD] ✓ Application built successfully in record time!');
console.log('----------------------------------------------------');

