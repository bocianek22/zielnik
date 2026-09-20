// Wypisuje notatki wydania dla wersji z CHANGELOG.md: node scripts/release-notes.js 0.15.0
const fs = require('fs');
const path = require('path');

const version = process.argv[2] || require('../package.json').version;
const text = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const start = text.search(new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm'));
if (start < 0) { console.error(`Brak sekcji [${version}] w CHANGELOG.md`); process.exit(1); }
const rest = text.slice(start).split('\n').slice(1).join('\n');
const end = rest.search(/^## \[|^\[[^\]]+\]: /m);
console.log((end < 0 ? rest : rest.slice(0, end)).trim());
