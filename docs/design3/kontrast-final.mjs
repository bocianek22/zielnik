// Kontrast finalnych tokenów z app/globals.css (Design 3, „Decyzja 9.10”). Użycie: node docs/design3/kontrast-final.mjs
// Te same pary sprawdza tests/theme.test.js; ten skrypt wypisuje wartości do tabeli w docs/DESIGN-3.md.
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (re) => Object.fromEntries([...css.match(re)[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// półprzezroczysta warstwa na kolorze (przycisk drugorzędny na hero)
const over = (bg, rgb, a) => '#' + [16, 8, 0].map((s) => Math.round(((rgb >> s) & 255) * a + ((parseInt(bg.slice(1), 16) >> s) & 255) * (1 - a)).toString(16).padStart(2, '0')).join('');
const CATS = ['stock', 'journal', 'rx', 'strain', 'social', 'learn'];
const rows = [
  ['tekst główny na tle', (b) => ratio(b['--text'], b['--bg'])],
  ['--text-3 na tle (najsłabszy tekst)', (b) => ratio(b['--text-3'], b['--bg'])],
  ['--text-2 na --surface-2', (b) => ratio(b['--text-2'], b['--surface-2'])],
  ['--on-btn na --btn (przycisk główny)', (b) => ratio(b['--on-btn'], b['--btn'])],
  ['--accent-text na tle (linki)', (b) => ratio(b['--accent-text'], b['--bg'])],
  ['--accent na tle (fokus, 3:1)', (b) => ratio(b['--accent'], b['--bg'])],
  ['--on-hero-2 na --hero-3 (podpisy w hero)', (b) => ratio(b['--on-hero-2'], b['--hero-3'])],
  ['biały na przycisku drugorzędnym hero (--hero-btn-2 na --hero-3)', (b) => ratio('#ffffff', over(b['--hero-3'], 0, Number(b['--hero-btn-2'].match(/,\s*([\d.]+)\)/)[1])))],
  ['min. --cat-*-ink na --cat-*-soft', (b) => Math.min(...CATS.map((c) => ratio(b[`--cat-${c}-ink`], b[`--cat-${c}-soft`])))],
  ['min. --text-2 na --cat-*-soft', (b) => Math.min(...CATS.map((c) => ratio(b['--text-2'], b[`--cat-${c}-soft`])))],
  ['min. --cat-*-ink na --surface', (b) => Math.min(...CATS.map((c) => ratio(b[`--cat-${c}-ink`], b['--surface'])))],
  ['min. --on-cat na --cat-* (pełny kafel)', (b) => Math.min(...CATS.map((c) => ratio(b['--on-cat'], b[`--cat-${c}`])))],
  ['--warn na --warn-soft', (b) => ratio(b['--warn'], b['--warn-soft'])],
  ['--danger na --danger-soft', (b) => ratio(b['--danger'], b['--danger-soft'])],
];
const light = block(/:root\s*\{([^}]*)\}/), dark = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
console.log('| Para | Jasny | Ciemny |\n|---|---|---|');
for (const [name, f] of rows) console.log(`| ${name} | ${f(light).toFixed(2).replace('.', ',')} | ${f(dark).toFixed(2).replace('.', ',')} |`);
