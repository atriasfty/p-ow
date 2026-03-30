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

    // We want to replace `return NextResponse.json(` with `return withRateLimit(NextResponse.json(`
    // But then we need to close it with `, auth)`.
    // Since these files are standard NextJS routes, we can just split by "return NextResponse.json("
    // And to find the matching closing parenthesis, we can count open/close parenthesis.

    let index = 0;
    while (true) {
        index = content.indexOf('return NextResponse.json(', index);
        if (index === -1) break;

        // Let's replace 'return NextResponse.json(' with 'return withRateLimit(NextResponse.json('
        content = content.substring(0, index) + 'return withRateLimit(NextResponse.json(' + content.substring(index + 25);
        index += 38; // length of 'return withRateLimit(NextResponse.json('

        let parens = 1;
        let cur = index;
        while (parens > 0 && cur < content.length) {
            if (content[cur] === '(') parens++;
            if (content[cur] === ')') parens--;
            cur++;
        }

        if (parens === 0) {
            // We found the matching closing paren!
            // It ends at cur-1.
            // We need to inject `, auth)` AFTER this closing paren.
            content = content.substring(0, cur) + ', auth)' + content.substring(cur);
            index = cur + 7;
        }
    }

    fs.writeFileSync(file, content);
});

console.log('Wrapped successfully');
