// „Rok objawów” (POM-50, lib/symptom-calendar.js): wartości dzień po dniu w czasie polskim, własne objawy, dni bez wartości
// pominięte, tylko dane właściciela, okno 371 dni. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const KEY = `t1:${Buffer.alloc(32, 7).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
let q, jar, pool, createSession;
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
  process.env.DATA_ENCRYPTION_KEY = KEY;
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});


after(async () => {
  if (savedKey == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = savedKey;
  if (pool) await pool.end();
});

test('rok objawów: wartości i własne objawy, bez pustych dni, tylko własne dane, okno', { skip }, async () => {
  const { symptomCalendar } = await import('../../lib/symptom-calendar.js');
  const A = ids.ania, B = ids.bartek;
  const ago = async (n) => (await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date - ${n}::int, 'YYYY-MM-DD') AS d`)[0].d;
  const [d1, d2, d3, dOld] = [await ago(1), await ago(2), await ago(3), await ago(400)];
  await q`INSERT INTO symptom_log (user_id, day, pain, sleep, note) VALUES (${A}, ${d1}::date, 7, 4, ''), (${A}, ${d2}::date, NULL, NULL, 'sama notatka'),
    (${A}, ${dOld}::date, 9, NULL, ''), (${B}, ${d1}::date, 1, NULL, '')`;
  const [c] = await q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${A}, 1, 'Apetyt') RETURNING id`;
  await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${c.id}, ${A}, ${d3}::date, 5)`;
  const r = await symptomCalendar(A);
  assert.equal(r.today, await ago(0));
  assert.deepEqual(r.rows.map((x) => x.day), [d3, d1], 'bez samej notatki i bez dnia sprzed okna');
  assert.equal(r.rows.find((x) => x.day === d1).pain, 7);
  assert.equal(r.rows.find((x) => x.day === d3)[`c${c.id}`], 5);
  assert.deepEqual(r.custom, [{ id: c.id, name: 'Apetyt' }]);
  const rb = await symptomCalendar(B);
  assert.deepEqual(rb.rows.map((x) => x.pain), [1]);
  assert.deepEqual(rb.custom, []);
});
