import test from 'node:test';
import assert from 'node:assert/strict';
import { measureScale, measurePoints } from '../lib/measure-chart.js';

test('skala obejmuje zakres wartości bez zera, z ładnym krokiem', () => {
  assert.deepEqual(measureScale([72.4, 74.9, 73]), { lo: 72, hi: 75, ticks: [72, 73, 74, 75] });
  assert.deepEqual(measureScale([118, 142]), { lo: 110, hi: 150, ticks: [110, 120, 130, 140, 150] });
  const s = measureScale([36.6, 36.9]);
  assert.ok(s.lo <= 36.6 && s.hi >= 36.9 && s.ticks.length <= 5);
});

test('jedna wartość albo równe: przedział wokół niej; brak wartości: null', () => {
  const s = measureScale([80]);
  assert.ok(s.lo < 80 && s.hi > 80);
  assert.ok(measureScale([0, 0]).lo < 0);
  assert.equal(measureScale([]), null);
  assert.equal(measureScale([NaN]), null);
});

test('punkty tylko dla dni z wartością tej serii', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03'];
  const vals = [{ day: '2026-10-03', id: 1, value: 70 }, { day: '2026-10-01', id: 1, value: 71 }, { day: '2026-10-02', id: 2, value: 5 }];
  assert.deepEqual(measurePoints(days, vals, 1), [{ i: 0, day: '2026-10-01', value: 71 }, { i: 2, day: '2026-10-03', value: 70 }]);
});
