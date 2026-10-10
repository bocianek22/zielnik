// Kontrast WCAG par tekst/tło dla kierunków A i B z docs/DESIGN-3.md. Użycie: node docs/design3/kontrast.mjs [--md]
import { A, B, CATS } from './tokens.mjs';
const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0); };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const rows = [];
for (const [dname, D] of [['A', A], ['B', B]]) {
  for (const mode of ['light', 'dark']) {
    const t = D[mode];
    const pairs = [
      ['--text', '--bg', 4.5], ['--text-2', '--bg', 4.5], ['--text-3', '--bg', 4.5], ['--text-2', '--surface', 4.5], ['--text-3', '--surface', 4.5],
      ['--text-2', '--surface-2', 4.5], ['--on-brand', '--brand', 4.5], ['--on-btn', '--btn', 4.5], ['--on-brand-soft', '--brand-soft', 4.5], ['--brand', '--surface', 3],
      ['--on-bar', '--bar', 4.5], ['--warn', '--warn-soft', 4.5], ['--warn', '--surface', 4.5], ['--danger', '--danger-soft', 4.5],
    ];
    if (t['--hero-2']) pairs.push(['--on-hero', '--hero-2', 4.5], ['--on-hero', '--hero-3', 4.5], ['--on-hero-2', '--hero-3', 4.5]);
    for (const c of CATS) {
      pairs.push([`--cat-${c}-ink`, `--cat-${c}-soft`, 4.5], ['--text', `--cat-${c}-soft`, 4.5], ['--text-2', `--cat-${c}-soft`, 4.5]); if (dname === 'A') pairs.push([`--cat-${c}`, `--cat-${c}-soft`, 3]);
      if (dname === 'B') pairs.push(['#ffffff', `--cat-${c}`, 4.5]);
      else pairs.push([`--cat-${c}`, '--surface', 3]);
      pairs.push([`--cat-${c}-ink`, '--surface', 4.5]);
    }
    for (const [f, b, min] of pairs) {
      const fv = f.startsWith('#') ? f : t[f], bv = t[b];
      const r = cr(fv, bv);
      rows.push({ dname, mode, f, b, r: r.toFixed(2), min, ok: r >= min });
    }
  }
}
const bad = rows.filter((r) => !r.ok);
if (process.argv[2] === '--md') {
  for (const d of ['A', 'B']) for (const m of ['light', 'dark']) {
    console.log(`\n${d} ${m}: ` + rows.filter((r) => r.dname === d && r.mode === m).map((r) => `${r.f.replace('--', '')}/${r.b.replace('--', '')} ${r.r.replace('.', ',')}`).join(' · '));
  }
} else {
  console.log(rows.length, 'par; niezaliczone:', bad.length);
  for (const r of bad) console.log(r);
}
