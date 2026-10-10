// Kalendarz zużycia (app/components/charts/calendar.js): siatka kwartałów, progi skali i cztery stany dnia (bez Reacta).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weekStart, quarters, thresholds, levelOf, dayState, monthLabels } from '../app/components/charts/calendar.js';

test('weekStart: poniedziałek tygodnia (niedziela należy do poprzedniego tygodnia)', () => {
  assert.equal(weekStart('2026-10-10'), '2026-10-05'); // sobota
  assert.equal(weekStart('2026-10-05'), '2026-10-05'); // poniedziałek
  assert.equal(weekStart('2026-10-11'), '2026-10-05'); // niedziela
});

test('quarters: 13 tygodni po 7 dni, ostatni tydzień kończy się na dziś, dni po dziś to null', () => {
  const [q] = quarters('2026-10-10');
  assert.equal(q.weeks.length, 13);
  assert.ok(q.weeks.every((w) => w.length === 7));
  assert.equal(q.weeks[12][0], '2026-10-05');
  assert.equal(q.weeks[12][5], '2026-10-10');
  assert.equal(q.weeks[12][6], null);
  assert.equal(q.weeks[0][0], '2026-07-13');
  const year = quarters('2026-10-10', 4);
  assert.equal(year.length, 4);
  assert.equal(year[3].first, q.first); // najnowszy kwartał na końcu
  const all = year.flatMap((b) => b.weeks.flat()).filter(Boolean);
  assert.equal(new Set(all).size, all.length); // kwartały się nie nakładają
  assert.equal(all.length, 52 * 7 - 1);
});

test('thresholds i levelOf: kwartyle dodatnich wartości, poziomy 1..4', () => {
  assert.deepEqual(thresholds([0, 0]), []);
  assert.equal(levelOf(1, thresholds([1])), 1);
  const th = thresholds([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
  assert.equal(th.length, 3);
  assert.deepEqual([0.5, 1.5, 2.5, 3.5].map((v) => levelOf(v, th)), [1, 2, 3, 4]);
  assert.ok([0.1, 1, 2, 3, 9].every((v) => levelOf(v, th) >= 1 && levelOf(v, th) <= 4));
});

test('dayState: brak wpisu, dzień bez zużycia, zużycie i zużycie tylko w drugiej jednostce', () => {
  assert.equal(dayState(undefined, 'g'), 'none');
  assert.equal(dayState({ g: 0, ml: 0, noUse: true }, 'g'), 'nouse');
  assert.equal(dayState({ g: 0.5, ml: 0, noUse: false }, 'g'), 'use');
  assert.equal(dayState({ g: 0.5, ml: 0 }, 'ml'), 'other');
  assert.equal(dayState({ g: 0, ml: 1 }, 'ml'), 'use');
  assert.equal(dayState({ g: 0.5, ml: 0, noUse: true }, 'g'), 'use'); // zużycie wygrywa ze znacznikiem
});

test('monthLabels: podpis w tygodniu z 1. dniem miesiąca, rok przy styczniu', () => {
  const [q] = quarters('2027-02-20');
  const labels = monthLabels(q.weeks);
  assert.deepEqual(labels.map((l) => l.text), ['gru', 'sty 2027', 'lut']);
  assert.ok(labels.every((l, i) => i === 0 || l.col > labels[i - 1].col));
});
