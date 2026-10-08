// POM-14: zapisy z kolejki offline: czas zapisu z telefonu (at), powiązanie z kontem (userId -> 409), ponowienia bez duplikatów.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  if (!mod[method]) return { status: 405, json: null };
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

const create = async (uid, f) => (await call(uid, 'strains', 'POST', { type: 'haze', ...f })).json.id;
const setEntry = async (uid, id, body) => {
  const r = await call(uid, 'strains/[id]/entry', 'PUT', body, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
};
const use = (uid, id, grams, requestId, extra = {}) => call(uid, 'strains/[id]/usage', 'POST', { grams, requestId, ...extra }, { id: String(id) });
const buy = (uid, id, grams, requestId, extra = {}) => call(uid, 'strains/[id]/purchase', 'POST', { grams, requestId, ...extra }, { id: String(id) });
const stock = async (uid, id) => Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${id} AND user_id = ${uid}`)[0].current_amount);
const poolOf = async (uid, id) => Number((await q`SELECT p.remaining_to_buy FROM user_pool p JOIN strains s ON p.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd, s.form)
                                                  WHERE s.id = ${id} AND p.user_id = ${uid}`)[0]?.remaining_to_buy ?? 0);
const usageRows = async (uid, id) => (await q`SELECT count(*)::int AS n FROM usage_log WHERE user_id = ${uid} AND strain_id = ${id}`)[0].n;
const purchaseRows = async (uid, id) => (await q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${uid} AND strain_id = ${id}`)[0].n;

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

const usageAt = async (rid) => (await q`SELECT created_at FROM usage_log WHERE request_id = ${rid}`)[0].created_at;
const purchaseAt = async (rid) => (await q`SELECT created_at FROM purchases WHERE request_id = ${rid}`)[0].created_at;
const near = (d, t, msg) => assert.ok(Math.abs(new Date(d).getTime() - t) < 60000, `${msg}: ${new Date(d).toISOString()}`);

test('zużycie z kolejki: czas z telefonu (do 72 h wstecz), ponowienie bez duplikatu', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Offline', producer: 'Aurora' });
  await setEntry(A, s, { current: 10 });
  const at = Date.now() - 9 * 3600e3;
  const rid = randomUUID();
  const r1 = await use(A, s, 0.5, rid, { at, userId: A });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.equal(new Date(await usageAt(rid)).getTime(), at);
  // ponowienie po zerwanym połączeniu (serwer zapisał, odpowiedź nie doszła): ten sam wpis i stan
  const r2 = await use(A, s, 0.5, rid, { at: Date.now(), userId: A });
  assert.equal(r2.json.id, r1.json.id);
  assert.equal(await usageRows(A, s), 1);
  assert.equal(await stock(A, s), 9.5);
  // przyszłość albo starsze niż 72 h: czas serwera
  const fut = randomUUID();
  await use(A, s, 0.1, fut, { at: Date.now() + 3600e3 });
  near(await usageAt(fut), Date.now(), 'przyszłość');
  const old = randomUUID();
  await use(A, s, 0.1, old, { at: Date.now() - 80 * 3600e3 });
  near(await usageAt(old), Date.now(), 'za stare');
  const junk = randomUUID();
  await use(A, s, 0.1, junk, { at: 'wczoraj' });
  near(await usageAt(junk), Date.now(), 'błędny czas');
});

test('wykup z kolejki: czas z telefonu i ponowienie bez duplikatu', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Offline wykup', producer: 'Tilray' });
  await setEntry(A, s, { current: 0, remaining: 10 });
  const at = Date.now() - 2 * 3600e3;
  const rid = randomUUID();
  const r1 = await buy(A, s, 4, rid, { at, userId: A });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.equal(new Date(await purchaseAt(rid)).getTime(), at);
  const r2 = await buy(A, s, 4, rid, { at, userId: A });
  assert.equal(r2.json.id, r1.json.id);
  assert.equal(await purchaseRows(A, s), 1);
  assert.equal(await stock(A, s), 4);
  assert.equal(await poolOf(A, s), 6);
});

test('zapis z kolejki innego konta: 409 i nic nie zapisano', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const s = await create(A, { name: 'Inne konto', producer: 'S-Lab' });
  await setEntry(B, s, { current: 5, remaining: 5 });
  const u = await use(B, s, 1, randomUUID(), { userId: A });
  assert.equal(u.status, 409);
  const p = await buy(B, s, 1, randomUUID(), { userId: A });
  assert.equal(p.status, 409);
  assert.equal(await usageRows(B, s), 0);
  assert.equal(await purchaseRows(B, s), 0);
  assert.equal(await stock(B, s), 5);
  const day = new Date().toISOString().slice(0, 10);
  const sy = await call(B, 'symptoms', 'PUT', { day, pain: 4, userId: A });
  assert.equal(sy.status, 409);
  assert.equal((await q`SELECT count(*)::int AS n FROM symptom_log WHERE user_id = ${B}`)[0].n, 0);
  // własny userId (i jego brak, starszy klient) działa jak dotąd
  assert.equal((await call(B, 'symptoms', 'PUT', { day, pain: 4, userId: B })).status, 200);
  assert.equal((await use(B, s, 1, randomUUID(), { userId: String(B) })).status, 200);
  assert.equal((await use(B, s, 1, randomUUID())).status, 200);
  assert.equal(await stock(B, s), 3);
});

test('DELETE /api/symptoms: błędna data daje 400, a nie błąd serwera', { skip }, async () => {
  const r = await call(ids.ania, 'symptoms', 'DELETE', { day: 'nie-data' });
  assert.equal(r.status, 400);
});
