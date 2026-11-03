#!/usr/bin/env node
/**
 * Automated Digital Menu Installer for Other Restaurant Projects
 * ──────────────────────────────────────────────────────────────────
 * Usage:
 *   node install-to-other-project.js "C:\path\to\other-restaurant-stock-system"
 */

const fs = require('fs');
const path = require('path');

const targetProjectDir = process.argv[2];

if (!targetProjectDir) {
  console.error('\n❌ ERROR: Please provide the target restaurant project path!');
  console.log('Example: node install-to-other-project.js "A:\\Other-Restaurant-System"\n');
  process.exit(1);
}

const resolvedTarget = path.resolve(targetProjectDir);

if (!fs.existsSync(resolvedTarget)) {
  console.error(`\n❌ ERROR: Target directory not found: ${resolvedTarget}\n`);
  process.exit(1);
}

console.log(`\n🚀 Installing Digital Menu to: ${resolvedTarget}\n`);

const currentDir = __dirname;

// 1. Helper to copy file safely
function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
  console.log(`  ✓ Copied: ${path.relative(resolvedTarget, dest)}`);
}

// 2. Copy Frontend Files
const clientFiles = [
  { src: path.join(currentDir, 'client', 'DigitalMenu.jsx'), dest: path.join(resolvedTarget, 'client', 'src', 'pages', 'DigitalMenu.jsx') },
  { src: path.join(currentDir, 'client', 'DigitalMenuSettings.jsx'), dest: path.join(resolvedTarget, 'client', 'src', 'components', 'settings', 'DigitalMenuSettings.jsx') },
  { src: path.join(currentDir, 'client', 'audioAlert.js'), dest: path.join(resolvedTarget, 'client', 'src', 'utils', 'audioAlert.js') },
  { src: path.join(currentDir, 'client', 'fileUrl.js'), dest: path.join(resolvedTarget, 'client', 'src', 'utils', 'fileUrl.js') },
];

console.log('📦 Step 1: Copying Frontend Components & Utilities...');
for (const file of clientFiles) {
  if (fs.existsSync(file.src)) {
    copyFile(file.src, file.dest);
  } else {
    console.warn(`  ⚠️ Source not found: ${file.src}`);
  }
}

// 3. Copy Backend Router
console.log('\n📦 Step 2: Copying Backend Standalone Router...');
const routerSrc = path.join(currentDir, 'server', 'digitalMenuStandaloneRouter.js');
const routerDest = path.join(resolvedTarget, 'server', 'routes', 'digitalMenuStandaloneRouter.js');
if (fs.existsSync(routerSrc)) {
  copyFile(routerSrc, routerDest);
} else {
  console.warn(`  ⚠️ Router source not found: ${routerSrc}`);
}

// 4. Inject Route into client/src/App.jsx
console.log('\n📦 Step 3: Injecting /menu Route into client/src/App.jsx...');
const appJsxPath = path.join(resolvedTarget, 'client', 'src', 'App.jsx');
if (fs.existsSync(appJsxPath)) {
  let appJsx = fs.readFileSync(appJsxPath, 'utf8');
  let modified = false;

  if (!appJsx.includes('DigitalMenu')) {
    // Add import
    appJsx = `import DigitalMenu from './pages/DigitalMenu';\n` + appJsx;
    modified = true;
  }

  if (!appJsx.includes('path="/menu"')) {
    // Add route before fallback or end of Routes
    if (appJsx.includes('</Routes>')) {
      appJsx = appJsx.replace('</Routes>', `  <Route path="/menu" element={<DigitalMenu />} />\n      </Routes>`);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(appJsxPath, appJsx, 'utf8');
    console.log('  ✓ Injected <Route path="/menu" element={<DigitalMenu />} /> into App.jsx');
  } else {
    console.log('  ✓ App.jsx already has DigitalMenu route.');
  }
} else {
  console.log('  ⚠️ client/src/App.jsx not found, please add <Route path="/menu" element={<DigitalMenu />} /> manually.');
}

// 5. Inject Router into server/server.js
console.log('\n📦 Step 4: Mounting Router in server/server.js...');
const serverJsPath = path.join(resolvedTarget, 'server', 'server.js');
if (fs.existsSync(serverJsPath)) {
  let serverJs = fs.readFileSync(serverJsPath, 'utf8');
  if (!serverJs.includes('digitalMenuStandaloneRouter')) {
    const hookMarker = 'app.use(';
    const firstUseIdx = serverJs.indexOf(hookMarker);
    const injectCode = `\n// Digital Menu & QR Ordering Router\ntry {\n  app.use('/api', require('./routes/digitalMenuStandaloneRouter'));\n} catch (e) { console.error('Digital menu router mount error:', e.message); }\n`;
    
    if (serverJs.includes("app.use('/api/")) {
      const idx = serverJs.indexOf("app.use('/api/");
      serverJs = serverJs.slice(0, idx) + injectCode + serverJs.slice(idx);
    } else if (firstUseIdx !== -1) {
      serverJs = serverJs.slice(0, firstUseIdx) + injectCode + serverJs.slice(firstUseIdx);
    } else {
      serverJs += injectCode;
    }
    fs.writeFileSync(serverJsPath, serverJs, 'utf8');
    console.log("  ✓ Mounted app.use('/api', require('./routes/digitalMenuStandaloneRouter')) in server.js");
  } else {
    console.log('  ✓ server.js already mounts digitalMenuStandaloneRouter.');
  }
} else {
  console.log("  ⚠️ server/server.js not found, please mount app.use('/api', require('./routes/digitalMenuStandaloneRouter')) manually.");
}

console.log('\n' + '═'.repeat(60));
console.log('🎉 DIGITAL MENU FULLY INSTALLED IN YOUR PROJECT!');
console.log('═'.repeat(60));
console.log('Next steps:');
console.log('1. Ensure frontend dependencies: npm install qrcode.react canvas-confetti lucide-react');
console.log('2. Start your servers and visit: http://localhost:5173/menu?table=Table%2001');
console.log('3. Open Settings -> Digital Menu to customize brand name, photos and tables.\n');

