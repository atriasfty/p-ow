const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function (file) {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts')) results.push(file);
        }
    });
    return results;
}

const files = walk('src/app/api/public/v1');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Revert the bad replaces:
    content = content.replace(/validatePublicApiKey,\s*withRateLimit\(\)/g, "validatePublicApiKey()");
    content = content.replace(/validatePublicApiKey\(\),\s*withRateLimit/g, "validatePublicApiKey()");

    // We also replaced `await validatePublicApiKey, withRateLimit()` to `await validatePublicApiKey()`
    // Let's just hard overwrite any bad occurrences of the auth call:
    content = content.replace(/const auth = await validatePublicApiKey(?:, withRateLimit\(\)|\(\), withRateLimit)/g, "const auth = await validatePublicApiKey()");

    // 2. Add withRateLimit to imports IF not there securely
    if (!content.includes('withRateLimit')) {
        content = content.replace(/import\s+\{([^}]+)\}\s+from\s+"@\/lib\/public-auth"/, (match, p1) => {
            return `import { ${p1.trim()}, withRateLimit } from "@/lib/public-auth"`;
        });
    }

    // 3. Wrap NextResponse.json(...) with withRateLimit(..., auth)
    // We can use a regex to replace "return NextResponse.json(X)" with "return withRateLimit(NextResponse.json(X), auth)"
    // The previous script did this: content.replace(/return NextResponse\.json\((.*?)\)/g, "return withRateLimit(NextResponse.json($1), auth)")
    // But it didn't match correctly over newlines!

    // A better approach: replace `return NextResponse.json(` with `return withRateLimit(NextResponse.json(`
    // and replace the closing `)` of the JSON response with `), auth)`? 
    // That's tricky.

    fs.writeFileSync(file, content);
});
console.log('Fixed auth calls.');
