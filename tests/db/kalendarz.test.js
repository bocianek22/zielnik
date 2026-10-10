// A5: dane kalendarza zużycia i pory przyjęcia (lib/usage-calendar.js): dni w czasie polskim, g i ml osobno, „dzień bez zużycia”
// (POM-38), tylko własne dane, okno dni, cztery pory w stałej kolejności (pole period albo godzina wpisu).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, cal;
const ids = {};
let S, OIL, day;

// wpis zużycia: `ago` dni temu o `hour`:30 czasu polskiego
const use = (uid, strain, grams, ago, hour = 12, period = null) => q`INSERT INTO usage_log (user_id, strain_id, grams, period, created_at)
  VALUES (${uid}, ${strain}, ${grams}, ${period},
    ((now() AT TIME ZONE 'Europe/Warsaw')::date - ${ago}::int + make_time(${hour}::int, 30, 0)) AT TIME ZONE 'Europe/Warsaw')`;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  cal = await import('../../lib/usage-calendar.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  [{ id: S }] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Susz', 'P', 'haze', 'susz') RETURNING id`;
  [{ id: OIL }] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Olej', 'P', 'haze', 'olej') RETURNING id`;
  const [d] = await q`SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS today`;
  day = (ago) => new Date(d.today.getTime() - ago * 86400000).toISOString().slice(0, 10);
  await use(ids.ania, S, 0.5, 0, 8); // dziś rano
  await use(ids.ania, S, 0.25, 0, 20); // dziś wieczorem: ten sam dzień, suma 0,75
  await use(ids.ania, OIL, 1, 2, 23); // olej, w nocy
  await use(ids.ania, S, 2, 5, 12, 'evening'); // pole period wygrywa z godziną
  await use(ids.ania, S, 3, 400, 12); // poza oknem kalendarza (371 dni), w oknie 90 dni też nie
  await use(ids.ania, S, 0, 4, 12); // zero gramów nie jest zużyciem
  await use(ids.bartek, S, 9, 1, 12); // cudze dane
  await q`INSERT INTO no_use_days (user_id, day) VALUES (${ids.ania}, ${day(3)}::date), (${ids.bartek}, ${day(6)}::date)`;
  await q`INSERT INTO no_use_days (user_id, day) VALUES (${ids.ania}, ${day(5)}::date)`; // stary znacznik na dniu ze zużyciem: wygrywa zużycie
});

after(async () => { if (pool) await pool.end(); });

test('usageCalendar: dzień po polsku z serwera, g i ml osobno, suma dnia, bez zera i bez cudzych danych', { skip }, async () => {
  const c = await cal.usageCalendar(ids.ania);
  assert.equal(c.today, day(0));
  assert.equal(c.from, day(370));
  const by = Object.fromEntries(c.rows.map((r) => [r.day, r]));
  assert.deepEqual(by[day(0)], { day: day(0), g: 0.75, ml: 0, n: 2, noUse: false });
  assert.deepEqual(by[day(2)], { day: day(2), g: 0, ml: 1, n: 1, noUse: false });
  assert.deepEqual(by[day(5)], { day: day(5), g: 2, ml: 0, n: 1, noUse: false });
  assert.equal(by[day(4)], undefined, 'wpis 0 g nie tworzy dnia');
  assert.equal(by[day(1)], undefined, 'zużycie bartka nie przecieka');
  assert.equal(by[day(400)], undefined, 'poza oknem');
  assert.deepEqual(c.rows.map((r) => r.day), [...c.rows.map((r) => r.day)].sort(), 'rosnąco po dniu');
});

test('usageCalendar: „dzień bez zużycia” tylko własny; zużycie w tym dniu wygrywa ze znacznikiem', { skip }, async () => {
  const c = await cal.usageCalendar(ids.ania);
  const by = Object.fromEntries(c.rows.map((r) => [r.day, r]));
  assert.deepEqual(by[day(3)], { day: day(3), g: 0, ml: 0, n: 0, noUse: true });
  assert.equal(by[day(5)].noUse, false);
  assert.equal(by[day(6)], undefined, 'znacznik bartka nie przecieka');
  const b = await cal.usageCalendar(ids.bartek);
  assert.deepEqual(b.rows.map((r) => r.day), [day(6), day(1)]);
  assert.equal(b.rows[0].noUse, true);
  assert.deepEqual((await cal.usageCalendar(999999)).rows, []);
});

test('usageCalendar: okno dni jest ograniczone', { skip }, async () => {
  const short = await cal.usageCalendar(ids.ania, 3);
  assert.equal(short.from, day(2));
  assert.deepEqual(short.rows.map((r) => r.day), [day(2), day(0)].sort());
  const huge = await cal.usageCalendar(ids.ania, 99999);
  assert.equal(huge.from, day(370));
});

test('usagePeriods: cztery pory w stałej kolejności, pole period albo godzina wpisu, okno 90 dni, tylko własne wpisy', { skip }, async () => {
  const p = await cal.usagePeriods(ids.ania);
  assert.deepEqual(p.rows.map((r) => r.key), ['morning', 'day', 'evening', 'night']);
  assert.deepEqual(p.rows.map((r) => r.label), ['rano', 'w ciągu dnia', 'wieczorem', 'w nocy']);
  // rano 8:30 (1), wieczorem 20:30 + period=evening (2), noc 23:30 (1); wpis z 400 dni temu i zero gramów nie wchodzą
  assert.deepEqual(p.rows.map((r) => r.n), [1, 0, 2, 1]);
  assert.equal(p.total, 4);
  assert.equal(p.days, 90);
  const none = await cal.usagePeriods(999999);
  assert.equal(none.total, 0);
  assert.equal(none.rows.length, 4);
  const wide = await cal.usagePeriods(ids.ania, 500);
  assert.equal(wide.total, 5, 'szerokie okno obejmuje wpis sprzed 400 dni (pora dzienna)');
  assert.equal(wide.rows[1].n, 1);
});
