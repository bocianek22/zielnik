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
