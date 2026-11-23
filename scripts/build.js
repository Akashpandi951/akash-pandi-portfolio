/**
 * scripts/build.js
 * Cross-platform production asset synchronization script.
 * Copies static assets, HTML templates, and admin portal files into:
 * 1. dist/ (for production Node/Express runtime)
 * 2. public/ (for Vercel, Netlify, Cloudflare Pages, and static hosting)
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFileSafe(src, dest) {
  if (fs.existsSync(src)) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied: ${path.relative(rootDir, src)} -> ${path.relative(rootDir, dest)}`);
  } else {
    console.warn(`! Source not found: ${path.relative(rootDir, src)}`);
  }
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  ensureDir(destDir);
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      copyFileSafe(srcPath, destPath);
    }
  }
}

console.log('\n========================================');
console.log('🚀 Synchronizing Production Build Assets');
console.log('========================================\n');

// 1. Ensure dist and public exist
ensureDir(distDir);
ensureDir(publicDir);

// 2. Copy assets directory
copyDirRecursive(path.join(rootDir, 'assets'), path.join(distDir, 'assets'));
copyDirRecursive(path.join(rootDir, 'assets'), path.join(publicDir, 'assets'));

// 3. Copy HTML templates
const filesToCopy = [
  'index.html',
  'admin.html',
  '404.html',
  'index_single_file_preview.html'
];

filesToCopy.forEach(file => {
  copyFileSafe(path.join(rootDir, file), path.join(distDir, file));
  copyFileSafe(path.join(rootDir, file), path.join(publicDir, file));
});

// 4. Copy admin directory
copyDirRecursive(path.join(rootDir, 'admin'), path.join(distDir, 'admin'));
copyDirRecursive(path.join(rootDir, 'admin'), path.join(publicDir, 'admin'));

console.log('\n✨ Production build assets synchronized successfully!\n');
