// Własny układ panelu „Dziś” (POM-48): GET/PUT /api/today-layout, tylko własne konto, nieznane klucze pomijane,
// ustawienie w eksporcie konta. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
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
  const mod = await import(`../../app/api/${route}/route.js`);
  const res = await mod.GET(new Request(`http://localhost/api/${route}`), { params: Promise.resolve({}) });
  return { status: res.status, json: await res.json() };
}

test('układ „Dziś”: zapis i odczyt na koncie, nieznane klucze pomijane, tylko własne', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  assert.deepEqual(ok(await get(A, 'today-layout')).hidden, []);
  assert.deepEqual(ok(await call(A, 'today-layout', 'PUT', { hidden: ['chart', 'rx', 'x; DROP TABLE users', 'chart'] })).hidden, ['chart', 'rx']);
  assert.deepEqual(ok(await get(A, 'today-layout')).hidden, ['chart', 'rx']);
  assert.deepEqual(ok(await get(B, 'today-layout')).hidden, [], 'inne konto bez zmian');
  assert.deepEqual(ok(await call(A, 'today-layout', 'PUT', { hidden: 'chart' })).hidden, ['chart'], 'napis zamiast tablicy');
  assert.equal((await call(null, 'today-layout', 'PUT', { hidden: [] })).status, 401);
  jar.clear(); await createSession(A);
  const exp = await (await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export'))).json();
  assert.equal(exp.profile.todayHidden, 'chart');
});
