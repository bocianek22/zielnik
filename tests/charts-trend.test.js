import test from 'node:test';
import assert from 'node:assert/strict';
import { rolling, segments } from '../app/components/charts/trend.js';

test('rolling: okno 7 dni, trend dopiero od 4 wpisów, dni bez wpisu zostają puste', () => {
  const v = [3, null, 4, null, 5, 6, null, null, null, null, null, null, null, 2];
  const r = rolling(v, 7, 4);
  assert.equal(r[0], null);
  assert.equal(r[4], null); // 3 wpisy w oknie
  assert.deepEqual(r[5], { mean: 4.5, lo: 3, hi: 6, n: 4 });
  assert.equal(r[1], null);
  assert.equal(r[13], null); // starsze wpisy wypadły z okna
});

test('rolling: okno nie zagląda w przyszłość', () => {
  const r = rolling([1, 1, 1, 1, 9, 9, 9], 7, 4);
  assert.equal(r[3].mean, 1);
  assert.equal(r[3].hi, 1);
});

test('segments: przerwa dłuższa niż maxGap rwie linię', () => {
  const it = (m) => ({ mean: m });
  const s = segments([it(1), it(2), null, null, it(3), null, null, null, null, it(4)], 3);
  assert.deepEqual(s.map((g) => g.map((p) => p.i)), [[0, 1, 4], [9]]);
  assert.deepEqual(segments([null, null]), []);
});
