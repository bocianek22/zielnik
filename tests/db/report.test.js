// Raport dla lekarza 2.0 (lib/report.js, POM-09): tydzień po tygodniu w czasie polskim, jednostki g i ml osobno,
// recepty w okresie, objawy przy odmianach (sen z następnego dnia).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, report;
const ids = {};
let susz, olej, susz2;

// znacznik czasu podany w czasie polskim (stałe daty, żeby granice tygodni były powtarzalne)
const pl = (s) => q`SELECT (${s}::timestamp AT TIME ZONE 'Europe/Warsaw') AS t`.then((r) => r[0].t);
const use = async (uid, sid, g, when) => q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${uid}, ${sid}, ${g}, ${await pl(when)})`;
const buy = async (uid, sid, g, when, cost = null) => q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, created_at)
  VALUES (${uid}, ${sid}, 'x', ${g}, ${cost}, ${await pl(when)})`;
const symp = (uid, day, pain, sleep, anxiety, mood) => q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood)
  VALUES (${uid}, ${day}::date, ${pain}, ${sleep}, ${anxiety}, ${mood})`;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  report = await import('../../lib/report.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = u.id;
  }
  [{ id: susz }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Lemon', 'haze', ${ids.ania}) RETURNING id`;
  [{ id: susz2 }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Tilray', 'Bediol', 'hybryda', ${ids.ania}) RETURNING id`;
  [{ id: olej }] = await q`INSERT INTO strains (producer, name, type, form, created_by) VALUES ('Curaleaf', 'Extractum', 'hybryda', 'olej', ${ids.ania}) RETURNING id`;

  const A = ids.ania;
  // okres raportu: środa 2026-09-02 .. środa 2026-09-23 (tygodnie od poniedziałku: 31.08, 07.09, 14.09, 21.09)
  await use(A, susz, 0.5, '2026-09-01 12:00');   // przed okresem
  await use(A, susz, 0.5, '2026-09-02 08:00');
  await use(A, olej, 0.3, '2026-09-02 21:00');
  await use(A, susz, 0.25, '2026-09-06 23:30');  // niedziela 23:30 w Polsce: jeszcze tydzień 31.08
  await use(A, susz, 1, '2026-09-07 00:30');     // poniedziałek 00:30 w Polsce (w UTC niedziela): już tydzień 07.09
  await use(A, susz2, 0.2, '2026-09-07 18:00');  // ten sam dzień, druga odmiana: dzień mieszany
  await use(A, olej, 0.5, '2026-09-22 10:00');
  await use(A, susz, 2, '2026-09-24 00:30');     // po okresie
  await use(ids.bartek, susz, 5, '2026-09-08 10:00'); // cudze

  await buy(A, susz, 10, '2026-09-03 12:00', 450);
  await buy(A, olej, 30, '2026-09-03 13:00', 600);
  await buy(A, susz, 5, '2026-09-21 00:30');     // poniedziałek 00:30: tydzień 21.09

  // tydzień 14.09 bez zużycia, ale z objawami
  await symp(A, '2026-09-02', 6, null, 4, 5);
  await symp(A, '2026-09-03', 4, 7, 2, 6);       // sen z 03.09 = noc po zużyciu 02.09
  await symp(A, '2026-09-07', 5, 4, 3, 5);
  await symp(A, '2026-09-08', 3, 8, 2, 7);
  await symp(A, '2026-09-15', 2, 6, 1, 8);
  await symp(A, '2026-09-16', 4, 6, 3, 6);
  await symp(A, '2026-09-24', 9, 9, 9, 9);       // po okresie: ani w tygodniach, ani jako sen dla 23.09
  await symp(ids.bartek, '2026-09-15', 10, 0, 10, 0);
});

after(async () => { if (pool) await pool.end(); });

test('weekly: tygodnie od poniedziałku w czasie polskim, każdy tydzień okresu, przycięte do okresu', { skip }, async () => {
  const { weekly } = await report.doctorReport(ids.ania, '2026-09-02', '2026-09-23');
  assert.deepEqual(weekly.map((w) => [w.start, w.end]), [
    ['2026-09-02', '2026-09-06'], ['2026-09-07', '2026-09-13'], ['2026-09-14', '2026-09-20'], ['2026-09-21', '2026-09-23'],
  ]);
  const [w1, w2, w3, w4] = weekly;
  // niedziela 23:30 zostaje w pierwszym tygodniu, poniedziałek 00:30 przechodzi do drugiego
  assert.equal(w1.used_g, 0.75);
  assert.equal(w1.used_ml, 0.3);
  assert.equal(w1.use_days, 2);
  assert.equal(w2.used_g, 1.2);
  assert.equal(w2.used_ml, 0);
  assert.equal(w2.use_days, 1);
  // tydzień bez zużycia, ale z wpisami objawów
  assert.equal(w3.used_g + w3.used_ml, 0);
  assert.equal(w3.use_days, 0);
  assert.equal(w3.sym_days, 2);
  assert.equal(w3.pain, 3);
  assert.equal(w3.sleep, 6);
  // wykup osobno w g i ml; zakup w poniedziałek 00:30 to już nowy tydzień
  assert.equal(w1.bought_g, 10);
  assert.equal(w1.bought_ml, 30);
  assert.equal(w4.bought_g, 5);
  assert.equal(w4.used_ml, 0.5);
  // średnie objawów i liczba dni z wpisem; AVG pomija puste pola (sen 02.09)
  assert.equal(w1.sym_days, 2);
  assert.equal(w1.pain, 5);
  assert.equal(w1.sleep, 7);
  assert.equal(w4.sym_days, 0);
  assert.equal(w4.pain, null);
});

test('sumy: g i ml nigdy razem, zużycie spoza okresu i cudze pominięte', { skip }, async () => {
  const { totals, usage, sym } = await report.doctorReport(ids.ania, '2026-09-02', '2026-09-23');
  assert.deepEqual(totals.used, { g: 1.95, ml: 0.8 });
  assert.deepEqual(totals.bought, { g: 15, ml: 30 });
  assert.equal(totals.cost, 1050);
  assert.deepEqual(usage.map((u) => [u.name, u.unit, u.days]), [['Lemon', 'g', 3], ['Bediol', 'g', 1], ['Extractum', 'ml', 2]]);
  assert.equal(sym.days, 6);
  // jeden dzień: jeden tydzień
  const one = await report.doctorReport(ids.ania, '2026-09-07', '2026-09-07');
  assert.equal(one.weekly.length, 1);
  assert.equal(one.weekly[0].used_g, 1.2);
});

test('recepty w okresie: wykup tej samej jednostki w ważności i do końca okresu, stan na koniec okresu', { skip }, async () => {
  const A = ids.ania;
  const rx = (issued, valid, g, unit = 'g') => q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams, unit)
    VALUES (${A}, ${issued}::date, ${valid}::date, ${g}, ${unit})`;
  await rx('2026-08-01', '2026-08-31', 20);          // wygasła przed okresem: pominięta
  await rx('2026-08-20', '2026-09-10', 20);          // wygasła w okresie: wykup 10 g (03.09), niewykorzystane 10 g
  await rx('2026-09-15', '2026-10-15', 4);           // ważna, wykupiona w całości (5 g z 21.09)
  await rx('2026-09-02', '2026-10-02', 60, 'ml');    // ważna, ml: 30 ml wykupu, zostało 30 ml
  await rx('2026-09-20', null, 10);                  // bez terminu: wykup 5 g z 21.09
  await rx('2026-09-24', '2026-10-24', 10);          // wystawiona po okresie: pominięta
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES (${ids.bartek}, '2026-09-05', '2026-10-05', 99)`;
  // zakup po końcu raportu nie zmienia stanu „na koniec okresu”
  await buy(A, susz, 50, '2026-09-25 12:00');

  const { rx: items, rxSum } = await report.doctorReport(A, '2026-09-02', '2026-09-23');
  assert.deepEqual(items.map((r) => [r.issued_on, r.unit, r.bought, r.remaining, r.status]), [
    ['2026-08-20', 'g', 10, 10, 'expired'],
    ['2026-09-02', 'ml', 30, 30, 'valid'],
    ['2026-09-15', 'g', 5, 0, 'used'],
    ['2026-09-20', 'g', 5, 5, 'valid'],
  ]);
  assert.equal(rxSum.issued, 3);
  assert.equal(rxSum.valid, 3);
  assert.deepEqual(rxSum.prescribed, { g: 34, ml: 60 });
  assert.deepEqual(rxSum.bought, { g: 20, ml: 30 });
  assert.deepEqual(rxSum.left, { g: 5, ml: 30 });
  assert.deepEqual(rxSum.unused, { g: 10, ml: 0 });
  // recepta ważna do ostatniego dnia okresu jest jeszcze ważna
  const [last] = (await report.doctorReport(A, '2026-08-01', '2026-09-10')).rx.filter((r) => r.issued_on === '2026-08-20');
  assert.equal(last.status, 'valid');
});

test('objawy przy odmianach: liczba dni, dni mieszane, sen z następnego dnia, bez danych spoza okresu', { skip }, async () => {
  const { strainSym } = await report.doctorReport(ids.ania, '2026-09-02', '2026-09-23');
  const by = Object.fromEntries(strainSym.map((s) => [s.name, s]));
  // Lemon: 02.09 (mieszany z olejem), 06.09, 07.09 (mieszany z Bediol)
  assert.equal(by.Lemon.days, 3);
  assert.equal(by.Lemon.mixed, 2);
  assert.equal(by.Lemon.n_pain, 2);        // wpisy 02.09 i 07.09 (06.09 bez wpisu)
  assert.equal(by.Lemon.pain, 5.5);
  assert.equal(by.Lemon.n_sleep, 3);       // sen z 03.09, 07.09 (noc po 06.09) i 08.09: 7, 4, 8
  assert.equal(Math.round(by.Lemon.sleep * 100), 633);
  assert.equal(by.Bediol.days, 1);
  assert.equal(by.Bediol.mixed, 1);
  assert.equal(by.Bediol.sleep, 8);
  // olej 22.09: brak wpisu 22.09 i 23.09; wpis z 24.09 jest po okresie
  assert.equal(by.Extractum.days, 2);
  assert.equal(by.Extractum.mixed, 1);
  assert.equal(by.Extractum.n_sleep, 1);   // 02.09 -> sen z 03.09
  assert.equal(by.Extractum.n_pain, 1);
  // kolejność po liczbie dni, nie po wartościach objawów
  assert.deepEqual(strainSym.map((s) => s.name), ['Lemon', 'Extractum', 'Bediol']);
  assert.equal(report.MIN_SYMPTOM_DAYS, 5);
});
