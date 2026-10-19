// „Przed wizytą” (lib/visit-prep.js): okno 7 dni, okres od ostatniej wizyty, średnie objawów, punkty „Do omówienia”, tylko własne dane.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, visitPrep;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  ({ visitPrep } = await import('../../lib/visit-prep.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });


// stała „teraz”: 18.10.2026, południe w Polsce
const NOW = new Date('2026-10-18T10:00:00Z');

test('bez wizyty w ciągu 7 dni nie ma karty', { skip }, async () => {
  const a = ids.ania;
  assert.equal(await visitPrep(a, NOW), null);
  await q`INSERT INTO visits (user_id, day, note) VALUES (${a}, '2026-10-26', ''), (${a}, '2026-09-01', '')`;
  assert.equal(await visitPrep(a, NOW), null, 'wizyta za 8 dni: jeszcze nie');
});

test('wizyta za kilka dni: okres od ostatniej wizyty, średnie, punkty do omówienia', { skip }, async () => {
  const a = ids.ania, b = ids.bartek;
  await q`INSERT INTO visits (user_id, day, note) VALUES (${a}, '2026-10-21', ''), (${a}, '2026-09-20', ''), (${b}, '2026-10-19', '')`;
  // od 20.09: ból 3 (4 wpisy); 28 dni wcześniej: ból 6 (3 wpisy); cudze wpisy i notatki nie liczą się
  await q`INSERT INTO symptom_log (user_id, day, pain) VALUES
    (${a}, '2026-09-20', 3), (${a}, '2026-10-01', 3), (${a}, '2026-10-10', 3), (${a}, '2026-10-18', 3),
    (${a}, '2026-09-01', 6), (${a}, '2026-09-10', 6), (${a}, '2026-09-19', 6), (${a}, '2026-08-01', 1),
    (${b}, '2026-10-10', 9)`;
  await q`INSERT INTO doctor_notes (user_id, text) VALUES (${a}, 'pytanie 1'), (${a}, 'pytanie 2'), (${b}, 'cudze')`;
  await q`UPDATE doctor_notes SET done = true WHERE text = 'pytanie 2'`;
  const p = await visitPrep(a, NOW);
  assert.equal(p.next, '2026-10-21'); assert.equal(p.daysTo, 3);
  assert.equal(p.last, '2026-09-20'); assert.equal(p.since, '2026-09-20'); assert.equal(p.today, '2026-10-18');
  assert.equal(p.notes, 1); assert.equal(p.days, 4);
  const pain = p.trends.find((t) => t.key === 'pain');
  assert.equal(pain.avg, 3); assert.equal(pain.n, 4); assert.equal(pain.diff, -3); assert.equal(pain.better, true);
  assert.equal(p.trends.find((t) => t.key === 'sleep').avg, null);
});

test('wizyta dziś i brak wcześniejszej: ostatnie 30 dni', { skip }, async () => {
  const b = ids.bartek;
  const p = await visitPrep(b, new Date('2026-10-19T08:00:00Z'));
  assert.equal(p.daysTo, 0); assert.equal(p.last, null); assert.equal(p.since, '2026-09-20');
  assert.equal(p.notes, 1); assert.equal(p.days, 1);
});

test('data wizyty z przypomnień też otwiera kartę', { skip }, async () => {
  const b = ids.bartek;
  await q`DELETE FROM visits WHERE user_id = ${b}`;
  assert.equal(await visitPrep(b, NOW), null);
  await q`INSERT INTO push_prefs (user_id, next_visit_on) VALUES (${b}, '2026-10-20')`;
  const p = await visitPrep(b, NOW);
  assert.equal(p.next, '2026-10-20'); assert.equal(p.daysTo, 2);
});

test('dzień z samą notatką nie liczy się jako dzień z wpisami; plan bez wymuszania Premium pozwala na raport', { skip }, async () => {
  const a = ids.ania;
  await q`INSERT INTO symptom_log (user_id, day) VALUES (${a}, '2026-10-17')`;
  const p = await visitPrep(a, NOW);
  assert.equal(p.days, 4); assert.equal(p.report, true);
});

test('pomiary w okresie: ostatnia wartość i zmiana od pierwszego, tylko własne i z okresu', { skip }, async () => {
  const a = ids.ania, b = ids.bartek;
  const [w] = await q`INSERT INTO measure_defs (user_id, slot, name, unit) VALUES (${a}, 1, 'Waga', 'kg') RETURNING id`;
  const [t] = await q`INSERT INTO measure_defs (user_id, slot, name, unit) VALUES (${a}, 2, 'Tętno', '') RETURNING id`;
  const [x] = await q`INSERT INTO measure_defs (user_id, slot, name, unit) VALUES (${b}, 1, 'Cudza', '') RETURNING id`;
  await q`INSERT INTO measure_values (def_id, user_id, day, value) VALUES
    (${w.id}, ${a}, '2026-09-10', 80), (${w.id}, ${a}, '2026-09-25', 75), (${w.id}, ${a}, '2026-10-15', 74.6),
    (${t.id}, ${a}, '2026-10-01', 70), (${x.id}, ${b}, '2026-10-01', 1)`;
  const p = await visitPrep(a, NOW);
  assert.deepEqual(p.measures, [
    { name: 'Waga', unit: 'kg', last: 74.6, n: 2, diff: -0.4 },
    { name: 'Tętno', unit: '', last: 70, n: 1, diff: null },
  ]);
});
