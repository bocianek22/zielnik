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
