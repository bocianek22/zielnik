// Pule "do wykupienia" (user_pool) przy edycji producenta/THC/CBD odmiany: PATCH /api/strains/[id]
// zmienia pool_key, więc wartości wszystkich osób muszą przejść na nowy klucz (DT-12).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, listStrains;
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

const create = async (uid, f) => (await call(uid, 'strains', 'POST', { type: 'haze', ...f })).json.id;
const edit = async (uid, id, f) => {
  const r = await call(uid, 'strains/[id]', 'PATCH', { type: 'haze', ...f }, { id: String(id) });
  if (r.status === 400 && /Nie zmieniono/.test(r.json.error)) return; // identyczne dane: propozycji nie ma
  if (r.status === 202) {
    // KAT-1: edycja cudzej odmiany to propozycja; przyjmuje ją admin, a autorem zmiany zostaje autor propozycji
    await q`UPDATE users SET must_change_password = FALSE WHERE is_admin`;
    const [p] = await q`SELECT id FROM strain_proposals WHERE strain_id = ${id} AND user_id = ${uid} AND status = 'oczekuje'`;
    const a = await call(ids.Bocian, 'admin/proposals', 'POST', { id: p.id, action: 'accept' });
    assert.equal(a.status, 200, JSON.stringify(a.json));
    return;
  }
  assert.equal(r.status, 200, JSON.stringify(r.json));
};
const setRemaining = async (uid, id, remaining) => {
  const r = await call(uid, 'strains/[id]/entry', 'PUT', { remaining }, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
};
// "do wykupienia" tak, jak widzi je właściciel na liście odmian
const remaining = async (uid, id) => Number((await listStrains(uid)).find((s) => s.id === id).entries.find((e) => e.userId === uid).remaining);
const poolRows = async (key) => (await q`SELECT user_id, remaining_to_buy::float8 AS r FROM user_pool WHERE pool_key = ${key} ORDER BY user_id`)
  .map((x) => [x.user_id, x.r]);

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
  ({ listStrains } = await import('../../lib/strains.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('zmiana THC przenosi "do wykupienia" wszystkich osób na nową pulę', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Przenoszona', producer: 'Aurora', thc: 20, cbd: 1 });
  await setRemaining(A, s, 10);
  await setRemaining(B, s, 5);
  await edit(B, s, { name: 'Przenoszona', producer: 'Aurora', thc: 22, cbd: 1 });
  assert.equal(await remaining(A, s), 10);
  assert.equal(await remaining(B, s), 5);
  assert.deepEqual(await poolRows('aurora|20.0|1.0'), []);
  assert.deepEqual(await poolRows('aurora|22.0|1.0'), [[A, 10], [B, 5]]);
  // zmiana pól spoza klucza niczego nie rusza
  await edit(A, s, { name: 'Przemianowana', producer: 'Aurora', thc: 22, cbd: 1 });
  assert.deepEqual(await poolRows('aurora|22.0|1.0'), [[A, 10], [B, 5]]);
  // odmiana bez THC ma pulę własną (strain:id); nadanie THC też przenosi wartości
  const n = await create(A, { name: 'Bez THC', producer: 'Aurora' });
  await setRemaining(A, n, 3);
  await edit(A, n, { name: 'Bez THC', producer: 'Aurora', thc: 25 });
  assert.equal(await remaining(A, n), 3);
  assert.deepEqual(await poolRows(`strain:${n}`), []);
});

test('gdy inna odmiana nadal ma stary klucz, stara pula zostaje, a nowa dostaje kopię', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s1 = await create(A, { name: 'Wspólna 1', producer: 'Tilray', thc: 18, cbd: 0 });
  const s2 = await create(A, { name: 'Wspólna 2', producer: 'Tilray', thc: 18, cbd: 0 });
  await setRemaining(A, s1, 7);
  await setRemaining(B, s2, 4);
  await edit(A, s1, { name: 'Wspólna 1', producer: 'Tilray', thc: 19, cbd: 0 });
  assert.equal(await remaining(A, s1), 7);
  assert.equal(await remaining(A, s2), 7);
  assert.equal(await remaining(B, s1), 4);
  assert.equal(await remaining(B, s2), 4);
  // od teraz to dwie osobne pule
  await setRemaining(A, s1, 2);
  assert.equal(await remaining(A, s2), 7);
  // istniejąca już nowa pula nie jest nadpisywana kopią
  const s3 = await create(A, { name: 'Wspólna 3', producer: 'Tilray', thc: 18, cbd: 0 });
  await edit(A, s3, { name: 'Wspólna 3', producer: 'Tilray', thc: 19, cbd: 0 });
  assert.equal(await remaining(A, s3), 2);
  assert.equal(await remaining(A, s2), 7);
});

test('kolizja z istniejącą pulą: zostaje większa wartość (ta sama recepta)', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s1 = await create(A, { name: 'Cel', producer: 'Cosma', thc: 15, cbd: 0 });
  const s2 = await create(A, { name: 'Źródło', producer: 'Cosma', thc: 16, cbd: 0 });
  await setRemaining(A, s1, 4);
  await setRemaining(A, s2, 9);
  await setRemaining(B, s1, 6);
  await setRemaining(B, s2, 1);
  await edit(A, s2, { name: 'Źródło', producer: 'cosma', thc: 15, cbd: 0 });
  assert.deepEqual(await poolRows('cosma|15.0|0.0'), [[A, 9], [B, 6]]);
  assert.deepEqual(await poolRows('cosma|16.0|0.0'), []);
  assert.equal(await remaining(A, s1), 9);
  assert.equal(await remaining(B, s2), 6);
});

test('równoległe edycje tej samej odmiany nie gubią puli', { skip }, async () => {
  const { ania: A } = ids;
  const s = await create(A, { name: 'Równoległa', producer: 'Tilray', thc: 20, cbd: 1 });
  await setRemaining(A, s, 10);
  const route = await import('../../app/api/strains/[id]/route.js');
  jar.clear();
  await createSession(A);
  const patch = (thc) => route.PATCH(new Request('http://localhost/', { method: 'PATCH', body: JSON.stringify({ name: 'Równoległa', producer: 'Tilray', type: 'haze', thc, cbd: 1 }) }),
    { params: Promise.resolve({ id: String(s) }) });
  // trzymamy blokadę odmiany, aż obie edycje będą na nią czekać, i dopiero wtedy puszczamy
  const lock = await pool.connect();
  await lock.query('BEGIN');
  await lock.query('SELECT 1 FROM strains WHERE id = $1 FOR UPDATE', [s]);
  const both = Promise.all([patch(21), patch(22)]);
  for (let i = 0; i < 100; i++) {
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND datname = current_database()");
    if (rows[0].n >= 2) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  await lock.query('COMMIT');
  lock.release();
  for (const r of await both) assert.equal(r.status, 200);
  const [st] = await q`SELECT pool_key(id, producer, thc, cbd, form) AS k FROM strains WHERE id = ${s}`;
  assert.equal(await remaining(A, s), 10);
  assert.deepEqual(await poolRows(st.k), [[A, 10]]);
  // zostaje tylko pula pod kluczem końcowym; kolejność edycji jest dowolna, więc końcowy może być 21 albo 22 % THC
  const keys = (await q`SELECT pool_key FROM user_pool WHERE user_id = ${A} AND pool_key IN ('tilray|20.0|1.0', 'tilray|21.0|1.0', 'tilray|22.0|1.0')`).map((x) => x.pool_key);
  assert.deepEqual(keys, [st.k]);
});
