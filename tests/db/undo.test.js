// POM-02: idempotencja szybkich zapisów (requestId) i „Cofnij” zużycia oraz wykupu.
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
const use = (uid, id, grams, requestId) => call(uid, 'strains/[id]/usage', 'POST', { grams, requestId }, { id: String(id) });
const buy = (uid, id, grams, requestId) => call(uid, 'strains/[id]/purchase', 'POST', { grams, requestId }, { id: String(id) });
const undoUse = (uid, id, entryId) => call(uid, 'strains/[id]/usage', 'DELETE', { id: entryId }, { id: String(id) });
const undoBuy = (uid, id, entryId) => call(uid, 'strains/[id]/purchase', 'DELETE', { id: entryId }, { id: String(id) });
const stock = async (uid, id) => Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${id} AND user_id = ${uid}`)[0].current_amount);
const poolOf = async (uid, id) => Number((await q`SELECT p.remaining_to_buy FROM user_pool p JOIN strains s ON p.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd)
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
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('zużycie: ponowienie z tym samym requestId zapisuje raz i zwraca ten sam wpis', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Ponowienie', producer: 'Aurora' });
  await setEntry(A, s, { current: 10 });
  const rid = randomUUID();
  const r1 = await use(A, s, 0.5, rid);
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  const r2 = await use(A, s, 0.5, rid);
  assert.equal(r2.status, 200, JSON.stringify(r2.json));
  assert.equal(r2.json.id, r1.json.id);
  assert.equal(r2.json.used, 0.5);
  assert.equal(r2.json.current, 9.5);
  assert.equal(await stock(A, s), 9.5);
  assert.equal(await usageRows(A, s), 1);
  // ponowienie z inną ilością dalej oddaje pierwszy wpis (nie zapisuje drugiego)
  const r3 = await use(A, s, 3, rid);
  assert.equal(r3.json.id, r1.json.id);
  assert.equal(r3.json.used, 0.5);
  assert.equal(await usageRows(A, s), 1);
  // ten sam requestId innej osoby to osobny wpis
  await setEntry(ids.bartek, s, { current: 2 });
  const rb = await use(ids.bartek, s, 0.5, rid);
  assert.notEqual(rb.json.id, r1.json.id);
  assert.equal(await stock(ids.bartek, s), 1.5);
  // bez requestId (starszy klient) zapis działa jak dotąd
  await use(A, s, 0.5);
  await use(A, s, 0.5);
  assert.equal(await usageRows(A, s), 3);
  assert.equal(await stock(A, s), 8.5);
  // błędny requestId nie powoduje błędu serwera
  assert.equal((await use(A, s, 0.5, 'x'.repeat(500))).status, 400);
});

test('równoległe ponowienia z tym samym requestId: jeden wpis, jedno odjęcie i jeden wykup', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Równoległa', producer: 'Tilray', thc: 18, cbd: 1 });
  await setEntry(A, s, { current: 10, remaining: 20 });
  const rid = randomUUID();
  const rs = await Promise.all(Array.from({ length: 6 }, () => use(A, s, 1, rid)));
  assert.ok(rs.every((r) => r.status === 200), JSON.stringify(rs.map((r) => r.json)));
  assert.equal(new Set(rs.map((r) => r.json.id)).size, 1);
  assert.equal(await usageRows(A, s), 1);
  assert.equal(await stock(A, s), 9);

  const rb = randomUUID();
  const bs = await Promise.all(Array.from({ length: 6 }, () => buy(A, s, 5, rb)));
  assert.ok(bs.every((r) => r.status === 200), JSON.stringify(bs.map((r) => r.json)));
  assert.equal(new Set(bs.map((r) => r.json.id)).size, 1);
  assert.equal(await purchaseRows(A, s), 1);
  assert.equal(await stock(A, s), 14);
  assert.equal(await poolOf(A, s), 15);
  // różne requestId dalej sumują się poprawnie
  await Promise.all(Array.from({ length: 4 }, () => use(A, s, 1, randomUUID())));
  assert.equal(await stock(A, s), 10);
  assert.equal(await usageRows(A, s), 5);
});

test('cofnięcie zużycia przywraca stan (także gdy zapisany stan był mniejszy niż zużycie)', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Cofana', producer: 'S-Lab' });
  await setEntry(A, s, { current: 5 });
  const r = await use(A, s, 1.25, randomUUID());
  assert.equal(await stock(A, s), 3.75);
  const u = await undoUse(A, s, r.json.id);
  assert.equal(u.status, 200, JSON.stringify(u.json));
  assert.equal(u.json.current, 5);
  assert.equal(u.json.used, -1.25);
  assert.equal(await stock(A, s), 5);
  assert.equal(await usageRows(A, s), 0);
  // drugie cofnięcie tego samego wpisu nic nie zmienia
  assert.equal((await undoUse(A, s, r.json.id)).status, 404);
  assert.equal(await stock(A, s), 5);
  // zużycie większe niż stan: stan spadł do 0 o 2 g, cofnięcie oddaje 2 g, nie 7 g
  await setEntry(A, s, { current: 2 });
  const short = await use(A, s, 7, randomUUID());
  assert.equal(short.json.stockShort, true);
  assert.equal(await stock(A, s), 0);
  const u2 = await undoUse(A, s, short.json.id);
  assert.equal(u2.json.current, 2);
  assert.equal(u2.json.used, -7);
  assert.equal(await stock(A, s), 2);
});

test('cofnięcie wykupu zdejmuje stan i oddaje pulę „do wykupienia” (także dla odmian z tej samej puli)', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Pula A', producer: 'Cosma', thc: 22, cbd: 1 });
  const mate = await create(A, { name: 'Pula B', producer: 'Cosma', thc: 22, cbd: 1 });
  await setEntry(A, s, { current: 1, remaining: 8 });
  const r = await buy(A, s, 10, randomUUID());
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.current, 11);
  assert.equal(r.json.remaining, 0);
  assert.equal(await poolOf(A, mate), 0);
  const u = await undoBuy(A, s, r.json.id);
  assert.equal(u.status, 200, JSON.stringify(u.json));
  // pula wraca o tyle, o ile ją faktycznie zmniejszono (8 g, nie 10 g)
  assert.deepEqual(u.json, { current: 1, remaining: 8, bought: -10 });
  assert.equal(await stock(A, s), 1);
  assert.equal(await poolOf(A, mate), 8);
  assert.equal(await purchaseRows(A, s), 0);
  assert.equal((await undoBuy(A, s, r.json.id)).status, 404);
  assert.equal(await poolOf(A, s), 8);
  // wykup bez puli: cofnięcie nie tworzy puli, a stan nie spada poniżej zera, gdy część już zużyto
  const n = await create(A, { name: 'Bez puli', producer: 'Cosma' });
  const b = await buy(A, n, 3, randomUUID());
  await use(A, n, 2, randomUUID());
  const u2 = await undoBuy(A, n, b.json.id);
  assert.deepEqual(u2.json, { current: 0, remaining: 0, bought: -3 });
  assert.equal(await poolOf(A, n), 0);
});

test('nie można cofnąć cudzego wpisu, wpisu innej odmiany ani wpisu sprzed ponad 10 minut', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Cudza', producer: 'Aurora', thc: 25, cbd: 0 });
  const other = await create(A, { name: 'Inna', producer: 'Aurora' });
  await setEntry(A, s, { current: 10, remaining: 10 });
  const ru = await use(A, s, 1, randomUUID());
  const rb = await buy(A, s, 2, randomUUID());
  // cudzy wpis: 404, nic się nie zmienia
  assert.equal((await undoUse(B, s, ru.json.id)).status, 404);
  assert.equal((await undoBuy(B, s, rb.json.id)).status, 404);
  // identyfikator wpisu z innej odmiany w adresie
  assert.equal((await undoUse(A, other, ru.json.id)).status, 404);
  assert.equal((await undoBuy(A, other, rb.json.id)).status, 404);
  assert.equal(await stock(A, s), 11);
  assert.equal(await poolOf(A, s), 8);
  // po czasie
  await q`UPDATE usage_log SET created_at = now() - interval '11 minutes' WHERE id = ${ru.json.id}`;
  await q`UPDATE purchases SET created_at = now() - interval '11 minutes' WHERE id = ${rb.json.id}`;
  assert.equal((await undoUse(A, s, ru.json.id)).status, 404);
  assert.equal((await undoBuy(A, s, rb.json.id)).status, 404);
  assert.equal(await stock(A, s), 11);
  assert.equal(await poolOf(A, s), 8);
  assert.equal(await usageRows(A, s), 1);
  assert.equal(await purchaseRows(A, s), 1);
  // błędny identyfikator
  assert.equal((await undoUse(A, s, 'abc')).status, 400);
  // wpis sprzed wdrożenia (bez zapamiętanej zmiany stanu) nie jest cofany
  const [old] = await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${A}, ${s}, 1) RETURNING id`;
  assert.equal((await undoUse(A, s, old.id)).status, 404);
});
