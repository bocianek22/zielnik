import test from 'node:test';
import assert from 'node:assert/strict';
import { openPrescriptions } from '../lib/rx-match.js';

const rx = (id, over) => ({ id, unit: 'g', grams: 10, bought: 0, issued_on: '2026-09-01', valid_until: '2026-10-30', ...over });

test('openPrescriptions: ważne dziś, ta sama jednostka, z gramami; najbliższa wygaśnięcia pierwsza', () => {
  const list = [
    rx(1, { valid_until: '2026-12-01' }), rx(2, { valid_until: '2026-10-20' }), rx(3, { valid_until: null }),
    rx(4, { bought: 10 }), rx(5, { valid_until: '2026-10-01' }), rx(6, { unit: 'ml' }), rx(7, { issued_on: '2026-11-01', valid_until: '2026-12-31' }),
  ];
  assert.deepEqual(openPrescriptions(list, 'g', '2026-10-08').map((p) => p.id), [2, 1, 3]);
  assert.deepEqual(openPrescriptions(list, 'ml', '2026-10-08').map((p) => p.id), [6]);
  assert.deepEqual(openPrescriptions(undefined, 'g', '2026-10-08'), []);
});
