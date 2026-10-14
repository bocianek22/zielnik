// Karta terapii (POM-58, lib/travel-card.js): recepty właściciela z terminem od dziś (wygasłe pominięte, bez terminu na
// końcu), zapas tylko własny i dodatni z jednostką odmiany (g/ml), bez notatek. Daty liczone od dziś.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, travelCard, addDaysIso, todayPL;
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
  ({ travelCard } = await import('../../lib/travel-card.js'));
  ({ addDaysIso, todayPL } = await import('../../lib/date.js'));
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, display_name) VALUES (${n}, 'x', ${n === 'ania' ? 'Ania K.' : ''}) RETURNING id`;
    ids[n] = u.id;
  }
});

after(async () => { if (pool) await pool.end(); });

test('karta terapii: ważne recepty z resztą do wykupienia, własny zapas, bez cudzych danych i notatek', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const t = todayPL();
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams, unit, note) VALUES (${A}, ${addDaysIso(t, -10)}::date, ${addDaysIso(t, 20)}::date, 30, 'g', 'dr Nowak')`;
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES (${A}, ${addDaysIso(t, -60)}::date, ${addDaysIso(t, -1)}::date, 10)`;
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams, unit) VALUES (${A}, ${addDaysIso(t, -5)}::date, NULL, 15, 'ml')`;
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES (${B}, ${addDaysIso(t, -3)}::date, ${addDaysIso(t, 30)}::date, 99)`;
  const [s1] = await q`INSERT INTO strains (name, producer, type) VALUES ('Susz A', 'Prod', 'haze') RETURNING id`;
  const [s2] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Olej B', 'Prod2', 'haze', 'olej') RETURNING id`;
  await q`INSERT INTO user_strain (user_id, strain_id, current_amount) VALUES (${A}, ${s1.id}, 4.5), (${A}, ${s2.id}, 0), (${B}, ${s2.id}, 7)`;

  const c = await travelCard(A);
  assert.equal(c.patient, 'Ania K.');
  assert.deepEqual(c.rx.map((r) => [r.unit, r.grams, r.valid_until == null]), [['g', 30, false], ['ml', 15, true]], 'wygasła pominięta, bez terminu na końcu');
  assert.ok(!JSON.stringify(c).includes('Nowak'), 'bez notatek recept');
  assert.deepEqual(c.stock, [{ name: 'Susz A', producer: 'Prod', unit: 'g', amount: 4.5 }]);
  const cb = await travelCard(B);
  assert.equal(cb.patient, 'bartek');
  assert.deepEqual(cb.rx.map((r) => r.grams), [99]);
  assert.deepEqual(cb.stock, [{ name: 'Olej B', producer: 'Prod2', unit: 'ml', amount: 7 }]);
});
