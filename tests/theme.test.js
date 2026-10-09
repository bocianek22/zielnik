// Tokeny motywu (app/globals.css): tryb ciemny jest zdefiniowany dwa razy (wybór ręczny i ustawienie systemu),
// więc oba bloki muszą być identyczne, a każdy token koloru z trybu jasnego musi mieć wartość ciemną.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const block = (re) => {
  const m = css.match(re);
  assert.ok(m, `brak bloku ${re}`);
  return Object.fromEntries([...m[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]));
};

test('oba bloki trybu ciemnego są identyczne', () => {
  const manual = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  const system = block(/:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/);
  assert.deepEqual(system, manual);
});

test('każdy kolor trybu jasnego ma odpowiednik w trybie ciemnym', () => {
  const light = block(/:root\s*\{([^}]*)\}/);
  const dark = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  const colors = Object.entries(light).filter(([, v]) => /^(#|rgba?\()/.test(v)).map(([k]) => k);
  const missing = colors.filter((k) => !(k in dark) && !['--shadow'].includes(k));
  assert.deepEqual(missing, []);
});

// Paleta wykresów z docs/UI-2.md (sekcja 2): walidator dataviz przechodzi tylko dla tych wartości, więc zmiana wymaga ponownej walidacji.
const PALETTE = {
  light: { '--chart-data': '#2f7d4a', '--chart-ref': '#8a948c',
    '--seq-1': '#8cc29b', '--seq-2': '#5ea173', '--seq-3': '#3b8155', '--seq-4': '#1f5a35',
    '--chart-1': '#2a72cc', '--chart-2': '#d65f2c', '--chart-3': '#14946b', '--chart-4': '#b27c00', '--chart-5': '#cf5f8c', '--chart-6': '#2e7d1f', '--chart-7': '#5546b0' },
  dark: { '--chart-data': '#86c597', '--chart-ref': '#76817a',
    '--seq-1': '#2a5a3a', '--seq-2': '#3f8457', '--seq-3': '#66b07e', '--seq-4': '#a2d9b1',
    '--chart-1': '#3987e5', '--chart-2': '#d95926', '--chart-3': '#199e70', '--chart-4': '#c98500', '--chart-5': '#d55181', '--chart-6': '#008300', '--chart-7': '#9085e9' },
};

test('paleta wykresów (--chart-*, --seq-*) zgadza się z docs/UI-2.md w obu motywach', () => {
  const pick = (b, want) => Object.fromEntries(Object.keys(want).map((k) => [k, b[k]]));
  assert.deepEqual(pick(block(/:root\s*\{([^}]*)\}/), PALETTE.light), PALETTE.light);
  assert.deepEqual(pick(block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/), PALETTE.dark), PALETTE.dark);
});

test('tokeny pomocnicze wykresów są w trzech blokach', () => {
  for (const re of [/:root\s*\{([^}]*)\}/, /:root\[data-theme="dark"\]\s*\{([^}]*)\}/, /:root:not\(\[data-theme="light"\]\)\s*\{([^}]*)\}/]) {
    const b = block(re);
    for (const k of ['--chart-data-soft', '--chart-band', '--chart-grid', '--chart-axis', '--chart-zero']) assert.ok(b[k], `${k} w ${re}`);
  }
});

// Design 3 (docs/DESIGN-3.md, „Decyzja”): kontrast WCAG 2.1 par tekst/tło w obu motywach, także kolorów obszarów (--cat-*)
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255].map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; })
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const CATS = ['stock', 'journal', 'rx', 'strain', 'social', 'learn'];
const PAIRS = [
  ['--text', '--bg', 4.5], ['--text-2', '--bg', 4.5], ['--text-3', '--bg', 4.5], ['--text-2', '--surface', 4.5], ['--text-3', '--surface', 4.5],
  ['--text-2', '--surface-2', 4.5], ['--on-btn', '--btn', 4.5], ['--on-accent', '--accent', 4.5], ['--on-accent-soft', '--accent-soft', 4.5],
  ['--accent-text', '--surface', 4.5], ['--accent-text', '--bg', 4.5], ['--accent', '--bg', 3], ['--on-bar', '--bar', 4.5],
  ['--warn', '--warn-soft', 4.5], ['--warn', '--surface', 4.5], ['--danger', '--danger-soft', 4.5],
  ['--on-hero', '--hero-2', 4.5], ['--on-hero', '--hero-3', 4.5], ['--on-hero-2', '--hero-3', 4.5], ['--on-hero-2', '--bar', 4.5],
  ...CATS.flatMap((c) => [[`--cat-${c}-ink`, `--cat-${c}-soft`, 4.5], ['--text', `--cat-${c}-soft`, 4.5], ['--text-2', `--cat-${c}-soft`, 4.5],
    [`--cat-${c}-ink`, '--surface', 4.5], ['--on-cat', `--cat-${c}`, 4.5]]),
];

test('kontrast par tekst/tło (WCAG AA) w obu motywach', () => {
  const light = block(/:root\s*\{([^}]*)\}/);
  const dark = block(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/);
  const bad = [];
  for (const [name, b] of [['jasny', light], ['ciemny', dark]]) {
    for (const [f, bg, min] of PAIRS) {
      assert.match(b[f] || '', /^#[0-9a-f]{6}$/i, `${f} (${name}) jako #rrggbb`);
      assert.match(b[bg] || '', /^#[0-9a-f]{6}$/i, `${bg} (${name}) jako #rrggbb`);
      const r = ratio(b[f], b[bg]);
      if (r < min) bad.push(`${name}: ${f} na ${bg} = ${r.toFixed(2)} < ${min}`);
    }
  }
  assert.deepEqual(bad, []);
});
