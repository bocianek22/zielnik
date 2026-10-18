// Buźka przy suwaku objawu (UI 5 etap 4): poziom 0–4 zależny od kierunku skali objawu
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faceLevel } from '../lib/mood-face.js';
import { SYMPTOMS, customMeta } from '../lib/symptoms.js';

test('faceLevel: ból i lęk niżej = lepiej, sen i nastrój wyżej = lepiej, puste bez buźki', () => {
  const dir = Object.fromEntries(SYMPTOMS.map((s) => [s.key, s.higherBetter]));
  assert.deepEqual(dir, { pain: false, sleep: true, anxiety: false, mood: true });
  assert.equal(faceLevel(0, dir.pain), 4);
  assert.equal(faceLevel(10, dir.pain), 0);
  assert.equal(faceLevel(10, dir.mood), 4);
  assert.equal(faceLevel(5, dir.mood), 2);
  assert.equal(faceLevel('', true), null);
  assert.equal(faceLevel(null, true), null);
  assert.equal(customMeta({ id: 1, name: 'Energia', higherBetter: true }).higherBetter, true);
  assert.equal(customMeta({ id: 2, name: 'Nudności', higher_better: false }).higherBetter, false);
});
