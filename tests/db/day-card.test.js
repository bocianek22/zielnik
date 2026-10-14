// Karta dnia (lib/day-card.js, GET /api/day): granica północy czasu polskiego, g i ml osobno, własne objawy i notatka,
// tylko dane właściciela, walidacja dnia; GET /api/symptoms?day= dołącza dzień spoza 60 dni. Uruchom: npm run test:db.
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
const ok = (r) => { assert.ok(r.status < 400, JSON.stringify(r.json)); return r.json; };
async function get(uid, route) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route.split('?')[0]}/route.js`);
  const res = await mod.GET(new Request(`http://localhost/api/${route}`), { params: Promise.resolve({}) });
  return { status: res.status, json: await res.json() };
}

test('karta dnia: zużycie wg dnia polskiego, g i ml, zakupy, objawy z notatką, dzień bez zużycia; tylko własne', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const susz = ok(await call(A, 'strains', 'POST', { name: 'Dzienna', producer: 'Aurora', type: 'haze' })).id;
  const olej = ok(await call(A, 'strains', 'POST', { name: 'Olejek', producer: 'Aurora', type: 'haze' })).id;
  await q`UPDATE strains SET form = 'olej' WHERE id = ${olej}`;
  // 2026-10-05 23:30 w Warszawie (CEST) = 21:30 UTC: ten sam dzień; 2026-10-05 00:30 w Warszawie = 4.10 22:30 UTC
  await q`INSERT INTO usage_log (user_id, strain_id, grams, method, period, created_at) VALUES
    (${A}, ${susz}, 0.3, 'vaporizer', 'evening', '2026-10-05T21:30:00Z'),
    (${A}, ${olej}, 0.5, NULL, NULL, '2026-10-04T22:30:00Z'),
    (${A}, ${susz}, 0.2, NULL, NULL, '2026-10-05T22:30:00Z'),
    (${B}, ${susz}, 9, NULL, NULL, '2026-10-05T10:00:00Z')`;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, created_at) VALUES (${A}, ${susz}, 'Dzienna', 5, '2026-10-05T08:00:00Z')`;
  ok(await call(A, 'symptoms', 'PUT', { day: '2026-10-05', pain: 3, note: 'Spokojny wieczór' }));
  const [c] = await q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${A}, 1, 'Apetyt') RETURNING id`;
  await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${c.id}, ${A}, '2026-10-05', 6)`;
  await q`INSERT INTO no_use_days (user_id, day) VALUES (${A}, '2026-10-03')`;

  const d = ok(await get(A, 'day?d=2026-10-05'));
  assert.deepEqual(d.usage.map((u) => [u.name, u.amount, u.unit, u.method, u.period]),
    [['Olejek', 0.5, 'ml', null, 'night'], ['Dzienna', 0.3, 'g', 'vaporizer', 'evening']]);
  assert.deepEqual(d.purchases.map((p) => [p.name, p.amount, p.unit]), [['Dzienna', 5, 'g']]);
  assert.equal(d.symptoms.pain, 3);
  assert.equal(d.symptoms.note, 'Spokojny wieczór');
  assert.deepEqual(d.symptoms.custom, [{ id: c.id, name: 'Apetyt', value: 6 }]);
  assert.equal(d.noUse, false);
  assert.equal(ok(await get(A, 'day?d=2026-10-03')).noUse, true);
  // 0,2 g z 6.10 00:30 czasu polskiego należy do 6.10
  assert.deepEqual(ok(await get(A, 'day?d=2026-10-06')).usage.map((u) => u.amount), [0.2]);

  // bartek widzi tylko swój wpis
  const b = ok(await get(B, 'day?d=2026-10-05'));
  assert.deepEqual(b.usage.map((u) => u.amount), [9]);
  assert.equal(b.symptoms, null);
  assert.deepEqual(b.purchases, []);
});

test('karta dnia: walidacja dnia i logowanie', { skip }, async () => {
  assert.equal((await get(ids.ania, 'day?d=2999-01-01')).status, 400);
  assert.equal((await get(ids.ania, 'day?d=1999-01-01')).status, 400);
  assert.equal((await get(ids.ania, 'day?d=abc')).status, 400);
  assert.equal((await get(null, 'day?d=2026-10-05')).status, 401);
});

test('dziennik: GET /api/symptoms?day= dołącza dzień sprzed 60 dni, zapis i usunięcie go zwracają', { skip }, async () => {
  const A = ids.ania;
  const old = '2025-12-01';
  await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${A}, ${old}, 7)`;
  assert.equal(ok(await get(A, 'symptoms')).rows.some((r) => r.day === old), false);
  assert.equal(ok(await get(A, `symptoms?day=${old}`)).rows.find((r) => r.day === old).pain, 7);
  const put = ok(await call(A, 'symptoms', 'PUT', { day: old, pain: 6 }));
  assert.equal(put.rows.find((r) => r.day === old).pain, 6);
  const del = ok(await call(A, 'symptoms', 'DELETE', { day: old }));
  assert.equal(del.rows.some((r) => r.day === old), false);
});

test('nieistniejący dzień (2026-02-31) to 400, a nie błąd bazy', { skip }, async () => {
  assert.equal((await get(ids.ania, 'day?d=2026-02-31')).status, 400);
  const r = ok(await get(ids.ania, 'symptoms?day=2026-02-31'));
  assert.ok(Array.isArray(r.rows));
});
