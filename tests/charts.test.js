// Moduł wykresów (app/components/charts): czyste funkcje skali i formatu (bez Reacta).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linear, niceTicks, band, barPath, smooth } from '../app/components/charts/scale.js';
import { num, ddmm, longDay, weekday, addDays, plural } from '../app/components/charts/fmt.js';

test('linear: mapuje przedział i obsługuje przedział pusty', () => {
  const y = linear([0, 10], [100, 0]);
  assert.equal(y(0), 100);
  assert.equal(y(10), 0);
  assert.equal(y(2.5), 75);
  assert.equal(linear([5, 5], [0, 20])(5), 10);
});

test('niceTicks: 0 i wielokrotności 1/2/5 × 10ⁿ, ostatnia pokrywa max', () => {
  assert.deepEqual(niceTicks(0), [0]);
  assert.deepEqual(niceTicks(-3), [0]);
  assert.deepEqual(niceTicks(10, 2), [0, 5, 10]);
  assert.deepEqual(niceTicks(0.9, 3), [0, 0.5, 1]);
  assert.deepEqual(niceTicks(0.3, 3), [0, 0.1, 0.2, 0.3]);
  assert.deepEqual(niceTicks(7, 3), [0, 5, 10]);
  assert.deepEqual(niceTicks(120, 3), [0, 50, 100, 150]);
  for (const max of [0.05, 0.37, 1, 3.2, 8, 47, 1234]) {
    const t = niceTicks(max, 3);
    assert.equal(t[0], 0);
    assert.ok(t.at(-1) >= max, `max ${max}: ${t}`);
    assert.ok(t.length <= 6, `max ${max}: ${t}`);
  }
});

test('band: równe przedziały, słupek pośrodku', () => {
  const b = band(4, 100, { pad: 0.2 });
  assert.equal(b.step, 25);
  assert.equal(b.bw, 20);
  assert.equal(b.x(0), 2.5);
  assert.equal(b.center(1), 37.5);
  assert.equal(band(0, 100).step, 0);
});

test('barPath: zaokrąglenie tylko u góry, zero i niska wysokość nie dają wartości ujemnych', () => {
  assert.equal(barPath(10, 20, 30, 80), 'M10,80V54Q10,50 14,50H26Q30,50 30,54V80Z');
  // wysokość < 4 px: promień = wysokość
  assert.equal(barPath(0, 20, 2, 10), 'M0,10V10Q0,8 2,8H18Q20,8 20,10V10Z');
  // wąski słupek: promień nie przekracza połowy szerokości
  assert.equal(barPath(0, 4, 30, 30), 'M0,30V2Q0,0 2,0H2Q4,0 4,2V30Z');
  // zero: nic ujemnego, nic NaN
  const zero = barPath(0, 10, 0, 50);
  assert.ok(!/NaN|-\d/.test(zero), zero);
});

test('smooth: przerwy zostają przerwami, mało wpisów = bez wygładzenia', () => {
  assert.deepEqual(smooth([1, null, 3], 3, 5), [1, null, 3]);
  assert.deepEqual(smooth([2, 2, 2, 2, 2], 3, 5), [2, 2, 2, 2, 2]);
  const s = smooth([0, 10, 0, 10, 0], 3, 5);
  assert.deepEqual(s, [5, 10 / 3, 20 / 3, 10 / 3, 5]);
  const gap = smooth([1, 1, null, 1, 5, 9], 3, 5);
  assert.equal(gap[2], null);
  assert.equal(gap.length, 6);
  const input = [1, 2, 3, 4, 5];
  smooth(input, 3, 5);
  assert.deepEqual(input, [1, 2, 3, 4, 5]);
});

test('fmt: liczby po polsku', () => {
  assert.equal(num(0.3), '0,3');
  assert.equal(num(8.5), '8,5');
  assert.equal(num(1.256), '1,26');
  assert.equal(num(1.256, 1), '1,3');
  assert.equal(num(20), '20');
  assert.equal(num(0), '0');
});

test('fmt: daty z łańcuchów ISO, bez strefy czasowej', () => {
  assert.equal(ddmm('2026-09-28'), '28.09');
  assert.equal(longDay('2026-10-09'), '9 października');
  assert.equal(longDay('2026-03-01'), '1 marca');
  assert.equal(weekday('2026-10-09'), 'pt.');
  assert.equal(weekday('2026-10-11'), 'niedz.');
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2026-10-09', 0), '2026-10-09');
});

test('fmt: plural', () => {
  const d = (n) => plural(n, 'dzień', 'dni');
  assert.deepEqual([1, 2, 5, 12, 22, 0].map(d), ['dzień', 'dni', 'dni', 'dni', 'dni', 'dni']);
  const w = (n) => plural(n, 'wpis', 'wpisy', 'wpisów');
  assert.deepEqual([1, 2, 4, 5, 12, 14, 22, 25, 112].map(w), ['wpis', 'wpisy', 'wpisy', 'wpisów', 'wpisów', 'wpisów', 'wpisy', 'wpisów', 'wpisów']);
});

test('layoutLabels: strony zakotwiczenia, rzędy przy nachodzeniu i pomijanie przy jednym rzędzie', async () => {
  const { layoutLabels } = await import('../app/components/charts/labels.js');
  const two = layoutLabels([{ key: 'a', text: 'dziś', x: 0 }, { key: 'b', text: 'ok. 11.10', x: 20 }], 326);
  assert.deepEqual(two.map((l) => [l.key, l.row, l.side]), [['a', 0, 'l'], ['b', 1, 'l']]);
  assert.equal(layoutLabels([{ key: 'r', text: 'ok. 11.10', x: 326 }], 326)[0].side, 'r');
  const one = layoutLabels([{ key: 'a', text: 'dziś', x: 0, prio: 2 }, { key: 'm', text: '06.10', x: 15, prio: 1 }, { key: 'z', text: '29.09', x: 200 }], 326, { rows: 1 });
  assert.deepEqual(one.map((l) => l.key), ['a', 'z']);
});
