// Wylogowanie czyści dane urządzenia (wspólny telefon): ostatnie wyszukiwania, data wizyty, token FCM; ustawienia zostają
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRIVATE_KEYS, clearDeviceData } from '../app/components/deviceData.js';

const store = () => {
  const m = new Map();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear() };
};

test('clearDeviceData: prywatne klucze i sessionStorage znikają, motyw, tryb dyskretny i blokada zostają', () => {
  const ls = store(), ss = store();
  globalThis.localStorage = ls; globalThis.sessionStorage = ss;
  try {
    for (const k of [...PRIVATE_KEYS, 'zielnik.theme', 'zielnik.discreet', 'zielnik.lock']) ls.setItem(k, 'x');
    ss.setItem('zielnik.unlocked', '1');
    clearDeviceData();
    assert.deepEqual([...ls.m.keys()].sort(), ['zielnik.discreet', 'zielnik.lock', 'zielnik.theme']);
    assert.equal(ss.m.size, 0);
  } finally { delete globalThis.localStorage; delete globalThis.sessionStorage; }
});

test('clearDeviceData nie rzuca bez localStorage (zablokowane dane witryny)', () => {
  assert.doesNotThrow(() => clearDeviceData());
});

test('każdy klucz z listy nadal istnieje w kodzie, który go zapisuje (zmiana nazwy = test czerwony)', () => {
  const src = ['app/szukaj/SearchBox.js', 'app/components/StrainsBoard.js', 'app/raport/VisitPeriod.js', 'app/components/native/bridge.js',
    'app/components/NativeShell.js', 'app/components/RegisterSW.js'].map((p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')).join('\n');
  for (const k of PRIVATE_KEYS) assert.ok(src.includes(`'${k}'`) || src.includes(`"${k}"`), k);
});
