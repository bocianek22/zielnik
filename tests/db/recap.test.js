// POM-42 porównanie okresów (lib/recap.js): granice okien o północy polskiej, g i ml osobno, wykup, dni aktywne,
// średnie objawów, dane innej osoby nie wchodzą.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { skip, setup } from './harness.mjs';

let q, pool, ids, periodCompare, periodWindow, Susz, Olej;
const TODAY = '2026-07-15'; // lato (UTC+2): 00:30 w Polsce to jeszcze poprzedni dzień w UTC

before(async () => {
  if (skip) return;
  ({ q, pool, ids } = await setup(['ania', 'bartek']));
  ({ periodCompare, periodWindow } = await import('../../lib/recap.js'));
  [{ id: Susz }] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Rc Susz', 'P', 'haze', 'susz') RETURNING id`;
  [{ id: Olej }] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Rc Olej', 'P', 'haze', 'olej') RETURNING id`;
});

after(async () => { if (pool) await pool.end(); });

// chwila w czasie polskim: dzień + godzina
const at = (day, hm) => `${day} ${hm}:00+02`;
const use = (uid, strain, grams, when) => q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${uid}, ${strain}, ${grams}, ${when}::timestamptz)`;
const buy = (uid, strain, grams, when) => q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, created_at) VALUES (${uid}, ${strain}, 'x', ${grams}, ${when}::timestamptz)`;

test('okna mają równą długość i przylegają do siebie', { skip }, () => {
  assert.deepEqual(periodWindow(TODAY, 30, 0), { from: '2026-06-16', to: '2026-07-15' });
  assert.deepEqual(periodWindow(TODAY, 30, 1), { from: '2026-05-17', to: '2026-06-15' });
  assert.deepEqual(periodWindow(TODAY, 90, 0), { from: '2026-04-17', to: '2026-07-15' });
  assert.deepEqual(periodWindow(TODAY, 90, 1), { from: '2026-01-17', to: '2026-04-16' });
});

test('granice okna: północ polska, nie UTC; dzień przed poprzednim oknem odpada', { skip }, async () => {
  const A = ids.ania;
  await use(A, Susz, 1, at('2026-06-16', '00:30')); // pierwszy dzień bieżącego okna (w UTC jeszcze 15.06 22:30)
  await use(A, Susz, 2, at('2026-07-15', '23:30')); // ostatni dzień bieżącego (dziś)
  await use(A, Susz, 4, at('2026-06-15', '23:30')); // ostatni dzień poprzedniego (w UTC 21:30 tego samego dnia)
  await use(A, Susz, 8, at('2026-05-17', '00:10')); // pierwszy dzień poprzedniego
  await use(A, Susz, 16, at('2026-05-16', '23:50')); // dzień przed poprzednim oknem: poza miesiącem
  await use(A, Susz, 32, at('2026-07-16', '00:10')); // jutro: poza
  const r = await periodCompare(A, { today: TODAY });
  assert.equal(r.month.cur.grams, 3);
  assert.equal(r.month.prev.grams, 12);
  assert.equal(r.month.cur.activeDays, 2);
  assert.equal(r.month.prev.activeDays, 2);
  assert.deepEqual([r.month.cur.from, r.month.cur.to, r.month.prev.from, r.month.prev.to], ['2026-06-16', '2026-07-15', '2026-05-17', '2026-06-15']);
  // kwartał (od 17.04) obejmuje wszystkie wpisy poza jutrzejszym
  assert.equal(r.quarter.cur.grams, 1 + 2 + 4 + 8 + 16);
  assert.equal(r.quarter.prev.grams, 0);
  await q`DELETE FROM usage_log`;
});

test('g i ml się nie sumują; wykup osobno; dwa wpisy tego dnia to jeden aktywny dzień', { skip }, async () => {
  const A = ids.ania;
  await use(A, Susz, 0.5, at('2026-07-10', '09:00'));
  await use(A, Olej, 0.25, at('2026-07-10', '21:00'));
  await use(A, Olej, 0.5, at('2026-06-20', '12:00'));
  await buy(A, Susz, 5, at('2026-07-01', '12:00'));
  await buy(A, Olej, 30, at('2026-07-02', '12:00'));
  await buy(A, Olej, 10, at('2026-06-01', '12:00')); // poprzedni okres
  await buy(A, null, 2, at('2026-07-03', '12:00')); // zakup bez odmiany liczy się jako gramy
  const { cur, prev } = (await periodCompare(A, { today: TODAY })).month;
  assert.equal(cur.grams, 0.5);
  assert.equal(cur.ml, 0.75);
  assert.equal(cur.activeDays, 2);
  assert.deepEqual([cur.boughtGrams, cur.boughtMl], [7, 30]);
  assert.deepEqual([prev.grams, prev.ml, prev.boughtGrams, prev.boughtMl], [0, 0, 0, 10]);
  await q`DELETE FROM usage_log`;
  await q`DELETE FROM purchases`;
});

test('średnie objawów: tylko dni z wartością, osobno dla okresów; brak wpisów to null', { skip }, async () => {
  const A = ids.ania;
  await q`INSERT INTO symptom_log (user_id, day, pain, sleep) VALUES
    (${A}, '2026-07-14', 4, 8), (${A}, '2026-07-15', 6, NULL), (${A}, '2026-06-16', 2, 6),
    (${A}, '2026-06-15', 9, 1), (${A}, '2026-06-10', 7, 3)`;
  const { cur, prev } = (await periodCompare(A, { today: TODAY })).month;
  assert.deepEqual(cur.symptoms.pain, { avg: 4, n: 3 });
  assert.deepEqual(cur.symptoms.sleep, { avg: 7, n: 2 });
  assert.deepEqual(cur.symptoms.anxiety, { avg: null, n: 0 });
  assert.deepEqual(prev.symptoms.pain, { avg: 8, n: 2 });
  assert.deepEqual(prev.symptoms.mood, { avg: null, n: 0 });
  await q`DELETE FROM symptom_log`;
});

test('dane innej osoby nie wchodzą', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  await use(B, Susz, 9, at('2026-07-10', '09:00'));
  await use(B, Olej, 9, at('2026-06-10', '09:00'));
  await buy(B, Susz, 9, at('2026-07-10', '09:00'));
  await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${B}, '2026-07-10', 10)`;
  const a = await periodCompare(A, { today: TODAY });
  for (const k of ['month', 'quarter']) for (const p of ['cur', 'prev']) {
    const s = a[k][p];
    assert.deepEqual([s.grams, s.ml, s.activeDays, s.boughtGrams, s.boughtMl, s.symptoms.pain.avg], [0, 0, 0, 0, 0, null]);
  }
  const b = await periodCompare(B, { today: TODAY });
  assert.equal(b.month.cur.grams, 9);
  assert.equal(b.month.prev.ml, 9);
  assert.equal(b.month.cur.symptoms.pain.avg, 10);
});
