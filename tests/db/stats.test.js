// Panel „Dziś” (lib/stats.js): zużycie dzienne w czasie polskim, ostatnio używane odmiany, odliczanie recept.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, stats;
const ids = {};
let s1, s2;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  stats = await import('../../lib/stats.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = u.id;
  }
  [{ id: s1 }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Lemon', 'haze', ${ids.ania}) RETURNING id`;
  [{ id: s2 }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Tilray', 'Bediol', 'hybryda', ${ids.ania}) RETURNING id`;
});

after(async () => { if (pool) await pool.end(); });

// znacznik czasu: dzień `back` dni temu (czas polski) o godzinie `hm` czasu polskiego
const at = (back, hm) => q`SELECT (((now() AT TIME ZONE 'Europe/Warsaw')::date - ${back}::int) + ${hm}::time) AT TIME ZONE 'Europe/Warsaw' AS t`.then((r) => r[0].t);

test('dailyUsageSeries: 14 dni, dziś na końcu, luki = 0, dzień według czasu polskiego', { skip }, async () => {
  const A = ids.ania;
  const add = async (uid, sid, g, back, hm) => q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${uid}, ${sid}, ${g}, ${await at(back, hm)})`;
  await add(A, s1, 0.5, 0, '08:00');
  await add(A, s2, 0.25, 0, '20:00');
  // 00:30 w Polsce to jeszcze poprzedni dzień w UTC: wpis musi trafić na dzień polski (2 dni temu)
  await add(A, s1, 0.75, 2, '00:30');
  // 23:30 w Polsce: ten sam dzień polski (3 dni temu), choć w UTC to wciąż ten dzień, a nie następny
  await add(A, s1, 0.4, 3, '23:30');
  await add(A, s1, 1, 13, '12:00');   // pierwszy dzień okna
  await add(A, s1, 9, 14, '12:00');   // poza oknem
  await add(ids.bartek, s1, 5, 0, '10:00'); // cudze zużycie

  const rows = await stats.dailyUsageSeries(A);
  assert.equal(rows.length, 14);
  const [{ today }] = await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS today`;
  assert.equal(rows.at(-1).day, today);
  const g = rows.map((r) => r.grams);
  assert.equal(g[13], 0.75);
  assert.equal(g[12], 0);
  assert.equal(g[11], 0.75);
  assert.equal(g[10], 0.4);
  assert.equal(g[0], 1);
  assert.equal(g.reduce((a, x) => a + x, 0), 2.9);
  // kolejne dni bez dziur
  for (let i = 1; i < rows.length; i++) assert.equal((Date.parse(rows[i].day) - Date.parse(rows[i - 1].day)) / 864e5, 1);
  // użytkownik bez wpisów: same zera
  const none = await stats.dailyUsageSeries(ids.bartek + 1000);
  assert.equal(none.length, 14);
  assert.ok(none.every((r) => r.grams === 0));
});

test('recentStrainIds: odmiany bez powtórzeń, ostatnio używana pierwsza, tylko własne wpisy', { skip }, async () => {
  assert.deepEqual(await stats.recentStrainIds(ids.ania), [s2, s1]);
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${ids.ania}, ${s1}, 0.1, now() + interval '1 day')`;
  assert.deepEqual(await stats.recentStrainIds(ids.ania), [s1, s2]);
  assert.deepEqual(await stats.recentStrainIds(ids.bartek), [s1]);
});

test('prescriptionCountdown: ważne i wygasłe z resztą do wykupienia, w kolejności terminu', { skip }, async () => {
  const A = ids.ania;
  const day = (back) => q`SELECT ((now() AT TIME ZONE 'Europe/Warsaw')::date - ${back}::int) AS d`.then((r) => r[0].d);
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES
    (${A}, ${await day(10)}, ${await day(-20)}, 30),
    (${A}, ${await day(5)}, ${await day(-3)}, 10),
    (${A}, ${await day(60)}, ${await day(30)}, 20),
    (${A}, ${await day(90)}, ${await day(70)}, 5),
    (${A}, ${await day(2)}, NULL, 15),
    (${ids.bartek}, ${await day(2)}, ${await day(-5)}, 10)`;
  // wykup 5 g dziś: liczy się do obu ważnych recept; 5 g sprzed 75 dni domyka najstarszą
  await q`INSERT INTO purchases (user_id, strain_name, grams, created_at) VALUES (${A}, 'Lemon', 5, now()), (${A}, 'Lemon', 5, ${await at(75, '12:00')})`;
  const r = await stats.prescriptionCountdown(A);
  assert.deepEqual(r.map((x) => [x.grams, x.days_left, x.remaining]), [[10, 3, 5], [30, 20, 25], [20, -30, 20]]);
  const b = await stats.prescriptionCountdown(ids.bartek);
  assert.deepEqual(b.map((x) => [x.grams, x.days_left, x.remaining]), [[10, 5, 10]]);
});
