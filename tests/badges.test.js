// UI 5 etap 5: odznaki za porządek, podsumowanie tygodnia i najdłuższa seria (czyste moduły): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { BADGES, badgesOf, newBadges } from '../lib/badges.js';
import { weekTrends, MIN_N } from '../lib/week-calc.js';
import { buildStreak } from '../lib/streak-calc.js';

const on = (s) => badgesOf(s).filter((b) => b.on).map((b) => b.key);

test('odznaki: puste konto bez odznak, progi regularności i dokumentów', () => {
  assert.deepEqual(on({}), []);
  assert.deepEqual(on({ total: 1, best: 1 }), ['first']);
  assert.deepEqual(on({ total: 7, best: 7 }), ['first', 'week']);
  assert.deepEqual(on({ total: 30, best: 6 }), ['first', 'days30'], '30 dni bez serii tygodniowej');
  assert.deepEqual(on({ total: 40, best: 30, rx: 2, visits: 1 }), BADGES.map((b) => b.key));
});

test('odznaki: tylko za regularność i dokumenty, nigdy za zużycie ani wartości objawów', () => {
  for (const b of BADGES) assert.doesNotMatch(`${b.label} ${b.how}`, /zuży|gram|odmian|konop|susz|ból|lęk|nastr/i, b.key);
  assert.deepEqual(on({ grams: 100, pain: 0 }), [], 'nieznane pola nie dają odznak');
});

test('nowe odznaki: pierwszy odczyt po cichu, potem tylko nowe', () => {
  assert.deepEqual(newBadges(['first', 'week'], null), { fresh: [], seen: ['first', 'week'] });
  assert.deepEqual(newBadges(['first', 'week'], 'first'), { fresh: ['week'], seen: ['first', 'week'] });
  assert.deepEqual(newBadges(['first'], 'first,week').fresh, [], 'utracona seria nie wraca jako nowa');
  assert.deepEqual(newBadges([], '').fresh, []);
});

test('tydzień: zmiana dopiero przy MIN_N wpisach w obu tygodniach, kierunek zależny od objawu', () => {
  const row = { pain_c: 3.25, pain_cn: MIN_N, pain_p: 4, pain_pn: MIN_N, sleep_c: 6, sleep_cn: 5, sleep_p: 7, sleep_pn: 4,
    anxiety_c: 2, anxiety_cn: 2, anxiety_p: 5, anxiety_pn: 7, mood_c: null, mood_cn: 0, mood_p: 5, mood_pn: 5 };
  const t = Object.fromEntries(weekTrends(row).map((x) => [x.key, x]));
  assert.deepEqual(t.pain, { key: 'pain', label: 'Ból', avg: 3.3, n: MIN_N, diff: -0.7, better: true });
  assert.equal(t.sleep.diff, -1); assert.equal(t.sleep.better, false, 'krótszy sen to nie poprawa');
  assert.equal(t.anxiety.diff, null, 'za mało wpisów w tym tygodniu'); assert.equal(t.anxiety.avg, 2);
  assert.equal(t.mood.avg, null);
  assert.ok(weekTrends(undefined).every((x) => x.avg == null && x.diff == null));
});

test('seria: najdłuższa w oknie i liczba dni z wpisem', () => {
  const r = buildStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-07', '2026-10-09', '2026-10-10'], '2026-10-10');
  assert.equal(r.best, 3); assert.equal(r.total, 6); assert.equal(r.streak, 2);
  assert.equal(buildStreak([], '2026-10-10').best, 0);
});
