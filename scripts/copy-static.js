import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const copyDir = (src, dest) => {
    if (!fs.existsSync(src)) {
        console.warn(`Warning: Source directory not found: ${src}`);
        return;
    }
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        try {
            if (entry.isDirectory()) {
                copyDir(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        } catch (err) {
            console.error(`Failed to copy ${srcPath} to ${destPath}:`, err.message);
        }
    }
};

const distDir = path.join(rootDir, 'dist');
const serverDir = path.join(rootDir, 'server');

console.log('Copying static files...');
copyDir(path.join(serverDir, 'workers'), path.join(distDir, 'workers'));
copyDir(path.join(serverDir, 'utils'), path.join(distDir, 'utils'));
console.log('Static files copied successfully.');
