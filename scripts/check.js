// Statyczna kontrola projektu (npm run check): brakujące pliki, brakujące eksporty, błędne eksporty tras API.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.next', '.git', '.data', 'scripts'].includes(f.name)) continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.js')) files.push(p);
  }
})(ROOT);

const resolve = (from, spec) => {
  const base = spec.startsWith('@/') ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(from), spec);
  return [base, base + '.js', path.join(base, 'index.js')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
};
const exportsOf = (src) => {
  const named = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+(\w+)/gm)) named.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]+)\}/gm)) m[1].split(',').forEach((n) => named.add(n.trim().split(/\s+as\s+/).pop()));
  return { named, def: /^export\s+default\b/m.test(src) };
};
const ROUTE_OK = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'dynamic', 'revalidate', 'runtime', 'maxDuration', 'fetchCache', 'dynamicParams', 'preferredRegion']);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+'([^']+)'/g)) {
    const spec = m[2];
    if (!spec.startsWith('@/') && !spec.startsWith('.')) continue;
    const target = resolve(file, spec);
    if (!target) { problems.push(`${rel}: brak pliku dla importu '${spec}'`); continue; }
    if (!target.endsWith('.js')) continue;
    const ex = exportsOf(fs.readFileSync(target, 'utf8'));
    const clause = m[1];
    const def = clause.replace(/\{[^}]*\}/, '').replace(/,/g, '').trim();
    if (def && !def.startsWith('*') && !ex.def) problems.push(`${rel}: '${spec}' nie ma eksportu domyślnego`);
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) for (const n of braces[1].split(',')) {
      const name = n.trim().split(/\s+as\s+/)[0];
      if (name && !ex.named.has(name)) problems.push(`${rel}: '${spec}' nie eksportuje '${name}'`);
    }
  }
  if (/[\\/]route\.js$/.test(file)) {
    for (const n of exportsOf(src).named) if (!ROUTE_OK.has(n)) problems.push(`${rel}: niedozwolony eksport trasy API '${n}'`);
  }
}
// wersja z package.json musi mieć wpis w CHANGELOG.md
const version = require('../package.json').version;
const changelog = fs.existsSync(path.join(ROOT, 'CHANGELOG.md')) ? fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8') : '';
if (!changelog.includes(`## [${version}]`)) problems.push(`CHANGELOG.md: brak sekcji dla wersji ${version} z package.json`);

if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log(`OK: sprawdzono ${files.length} plików, bez problemów.`);
