// Wzorce wg dnia tygodnia (POM-54): poprawny dzień tygodnia (ISO, Pn = 0), próg MIN_DAYS, własne objawy, tylko własne dane,
// działa bez zapisów zużycia. Daty liczone od dziś. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, weekdayObservations, addDaysIso, todayPL;
const ids = {};

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await import('./headers-shim.mjs');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ weekdayObservations } = await import('../../lib/weekday-obs.js'));
  ({ addDaysIso, todayPL } = await import('../../lib/date.js'));
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = u.id;
  }
});

after(async () => { if (pool) await pool.end(); });

// dzień tygodnia ISO (1 = poniedziałek) dla RRRR-MM-DD
const isoDow = (d) => ((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

test('dni tygodnia: średnie w stałej kolejności Pn–Nd, próg, własny objaw, tylko własne dane', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const today = todayPL();
  // ostatni poniedziałek (włącznie z dziś) i 5 kolejnych poniedziałków wstecz: ból 4; wtorki tylko 2 razy
  const mon0 = addDaysIso(today, -(isoDow(today) - 1));
  const mondays = [0, 1, 2, 3, 4].map((w) => addDaysIso(mon0, -7 * w));
  for (const d of mondays) await q`INSERT INTO symptom_log (user_id, day, pain, sleep) VALUES (${A}, ${d}::date, 4, 8)`;
  for (const w of [1, 2]) await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${A}, ${addDaysIso(mon0, 1 - 7 * w)}::date, 9)`;
  const [c] = await q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${A}, 1, 'Apetyt') RETURNING id`;
  for (const d of mondays) await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${c.id}, ${A}, ${d}::date, 6)`;
  // cudze dane w te same dni
  for (const d of mondays) await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${B}, ${d}::date, 10)`;

  const r = await weekdayObservations(A, 90);
  const pain = r.symptoms.find((s) => s.key === 'pain');
  assert.deepEqual(pain.days[0], { days: 5, avg: 4 }, 'poniedziałek');
  assert.deepEqual(pain.days[1], { days: 2, avg: null }, 'wtorek poniżej progu: tylko liczba dni');
  assert.deepEqual(pain.days.slice(2).map((x) => x.days), [0, 0, 0, 0, 0]);
  assert.equal(r.symptoms.find((s) => s.key === 'sleep').days[0].avg, 8);
  const custom = r.symptoms.find((s) => s.key === `c${c.id}`);
  assert.equal(custom.custom, true);
  assert.equal(custom.days[0].avg, 6);
  assert.equal(r.symptoms.find((s) => s.key === 'mood'), undefined, 'objaw bez wpisów pominięty');
  // okres 30 dni: najstarsze poniedziałki wypadają z okna
  const r30 = await weekdayObservations(A, 30);
  assert.equal(r30.symptoms.find((s) => s.key === 'pain').days[0].days, mondays.filter((d) => d >= addDaysIso(today, -29)).length);
  // B widzi tylko swoje
  const rb = await weekdayObservations(B, 90);
  assert.deepEqual(rb.symptoms.map((s) => s.key), ['pain']);
  assert.equal(rb.symptoms[0].days[0].avg, 10);
});
