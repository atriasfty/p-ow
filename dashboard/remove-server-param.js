const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
    });
}

function processFile(filePath) {
    if (!filePath.endsWith('route.ts')) return;

    let content = fs.readFileSync(filePath, 'utf8');

    // Remove "const serverName = ..."
    content = content.replace(/[ \t]*const serverName = searchParams\.get\("server"\)( \|\| body\.server \|\| body\.serverName)?\s*\n?/g, '');

    // Remove "if (!serverName) { ... }" block
    content = content.replace(/[ \t]*if \(!serverName\) \{\n[ \t]*return[^\n]*"Missing 'server'[^\n]*\n[ \t]*\}\n?/g, '');
    // Also inline version
    content = content.replace(/[ \t]*if \(!serverName\) return[^\n]*"Missing 'server'[^\n]*\n?/g, '');

    // Sometimes searchParams isn't used after this, but we'll leave const { searchParams } alone to avoid breaking URL parsing if used elsewhere.
    // Let's check if we missed anything. I'll just save it.

    fs.writeFileSync(filePath, content);
    console.log(`Processed ${filePath}`);
}

walkDir('./src/app/api/public/v1', processFile);
console.log("Done");
