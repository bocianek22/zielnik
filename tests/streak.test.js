// POM-08: czysta część serii wpisów objawów (lib/streak.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStreak } from '../lib/streak-calc.js';

const T = '2026-10-10';

test('brak wpisów: seria 0, siedem pustych dni', () => {
  const r = buildStreak([], T);
  assert.equal(r.streak, 0);
  assert.equal(r.weekCount, 0);
  assert.equal(r.week.length, 7);
  assert.equal(r.week[0].day, '2026-10-04');
  assert.equal(r.week[6].day, T);
});

test('kolejne dni do dziś: seria i kropki', () => {
  const r = buildStreak(['2026-10-10', '2026-10-09', '2026-10-08', '2026-10-05'], T);
  assert.equal(r.streak, 3);
  assert.equal(r.weekCount, 4);
  assert.deepEqual(r.week.map((d) => d.on), [false, true, false, false, true, true, true]);
});

test('brak dzisiejszego wpisu nie zeruje serii (liczymy do wczoraj)', () => {
  assert.equal(buildStreak(['2026-10-09', '2026-10-08'], T).streak, 2);
});

test('przerwa wczoraj: seria 0, ale kropki pokazują wpisy z tygodnia', () => {
  const r = buildStreak(['2026-10-08', '2026-10-07'], T);
  assert.equal(r.streak, 0);
  assert.equal(r.weekCount, 2);
});

test('seria przez granicę miesiąca i zmiany czasu', () => {
  assert.equal(buildStreak(['2026-03-30', '2026-03-29', '2026-03-28', '2026-03-27'], '2026-03-30').streak, 4);
  assert.equal(buildStreak(['2026-11-01', '2026-10-31', '2026-10-30'], '2026-11-01').streak, 3);
});
