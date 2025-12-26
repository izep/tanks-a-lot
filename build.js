const fs = require('fs');
const path = require('path');

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(distDir, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// Copy files from src to dist
const srcDir = path.join(__dirname, 'src');
const filesToCopy = ['styles.css', 'manifest.json', 'service-worker.js'];

filesToCopy.forEach(file => {
    const srcPath = path.join(srcDir, file);
    const distPath = path.join(distDir, file);

    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, distPath);
        console.log(`Copied ${file}`);
    } else {
        console.warn(`Warning: ${file} not found in src directory`);
    }
});

// Note: Vite handles bundling Phaser code to dist/phaser/
// This script just copies static assets

// Copy icons if they exist
const srcIconsDir = path.join(srcDir, 'icons');
if (fs.existsSync(srcIconsDir)) {
    const iconFiles = fs.readdirSync(srcIconsDir);
    iconFiles.forEach(file => {
        const srcPath = path.join(srcIconsDir, file);
        const distPath = path.join(iconsDir, file);
        fs.copyFileSync(srcPath, distPath);
        console.log(`Copied icon: ${file}`);
    });
}

console.log('Build complete!');
