// Korekty wpisów zużycia i wykupu w Historii (PATCH/DELETE /api/history/...) oraz uzupełnianie brakujących kosztów.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, todayPL, addDaysIso;
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
const setEntry = async (uid, id, body) => {
  const r = await call(uid, 'strains/[id]/entry', 'PUT', body, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json;
};
const use = async (uid, id, grams) => (await call(uid, 'strains/[id]/usage', 'POST', { grams, requestId: randomUUID() }, { id: String(id) })).json;
const buy = async (uid, id, grams) => (await call(uid, 'strains/[id]/purchase', 'POST', { grams, requestId: randomUUID() }, { id: String(id) })).json;
const fixUse = (uid, entryId, body) => call(uid, 'history/usage/[id]', 'PATCH', body, { id: String(entryId) });
const delUse = (uid, entryId) => call(uid, 'history/usage/[id]', 'DELETE', null, { id: String(entryId) });
const fixBuy = (uid, entryId, body) => call(uid, 'history/purchases/[id]', 'PATCH', body, { id: String(entryId) });
const delBuy = (uid, entryId) => call(uid, 'history/purchases/[id]', 'DELETE', null, { id: String(entryId) });
const stock = async (uid, id) => Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${id} AND user_id = ${uid}`)[0].current_amount);
const poolOf = async (uid, id) => Number((await q`SELECT p.remaining_to_buy FROM user_pool p JOIN strains s ON p.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd, s.form)
                                                  WHERE s.id = ${id} AND p.user_id = ${uid}`)[0]?.remaining_to_buy ?? 0);
const usageRow = async (entryId) => (await q`SELECT grams::float8 AS grams, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
                                            FROM usage_log WHERE id = ${entryId}`)[0];
const purchaseRow = async (entryId) => (await q`SELECT grams::float8 AS grams, cost::float8 AS cost, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
                                               FROM purchases WHERE id = ${entryId}`)[0];

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
  ({ todayPL, addDaysIso } = await import('../../lib/date.js'));
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

test('korekta gramów zużycia przelicza stan; potem „Cofnij” wraca dokładnie do stanu wyjściowego', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Korekta zużycia', producer: 'Aurora' });
  await setEntry(A, s, { current: 10 });
  const u = await use(A, s, 1);
  assert.equal(await stock(A, s), 9);
  const r1 = await fixUse(A, u.id, { grams: 0.1 }); // pomyłka „1” zamiast „0,1”
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.equal(r1.json.current, 9.9);
  assert.equal((await usageRow(u.id)).grams, 0.1);
  await fixUse(A, u.id, { grams: 2 });
  assert.equal(await stock(A, s), 8);
  const back = await call(A, 'strains/[id]/usage', 'DELETE', { id: u.id }, { id: String(s) });
  assert.equal(back.status, 200, JSON.stringify(back.json));
  assert.equal(await stock(A, s), 10);
  // stan mniejszy niż zużycie: odjęto tylko 2 g; korekta w dół oddaje część faktycznie odjętą, nie schodzi poniżej 0
  await setEntry(A, s, { current: 2 });
  const big = await use(A, s, 7);
  assert.equal(await stock(A, s), 0);
  await fixUse(A, big.id, { grams: 1 });
  assert.equal(await stock(A, s), 1, 'miałem 2 g, zużyłem 1 g');
  await fixUse(A, big.id, { grams: 5 });
  assert.equal(await stock(A, s), 0);
  // błędne dane
  assert.equal((await fixUse(A, big.id, { grams: 0 })).status, 400);
  assert.equal((await fixUse(A, big.id, { grams: 5000 })).status, 400);
  assert.equal((await fixUse(A, big.id, {})).status, 400);
});

test('korekta gramów wykupu przelicza stan i pulę „do wykupienia”; „Cofnij” po korekcie wraca do stanu wyjściowego', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Korekta wykupu', producer: 'Cosma', thc: 20, cbd: 1 });
  const mate = await create(A, { name: 'Korekta wykupu 2', producer: 'Cosma', thc: 20, cbd: 1 });
  await setEntry(A, s, { current: 1, remaining: 8 });
  const b = await buy(A, s, 5);
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [6, 3]);
  const r1 = await fixBuy(A, b.id, { grams: 10 });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.deepEqual([r1.json.current, r1.json.remaining], [11, 0]);
  assert.deepEqual([await stock(A, s), await poolOf(A, mate)], [11, 0]);
  // z 10 g pula pokryła 8 g; po zmianie na 4 g w puli zostaje 8 - 4 = 4 g
  await fixBuy(A, b.id, { grams: 4 });
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [5, 4]);
  const back = await call(A, 'strains/[id]/purchase', 'DELETE', { id: b.id }, { id: String(s) });
  assert.equal(back.status, 200, JSON.stringify(back.json));
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [1, 8]);
});

test('usunięcie wpisów zużycia i wykupu (także starych, bez zapamiętanej zmiany stanu)', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Usuwana', producer: 'Tilray', thc: 18, cbd: 0 });
  await setEntry(A, s, { current: 5, remaining: 10 });
  const u = await use(A, s, 2);
  const b = await buy(A, s, 4);
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [7, 6]);
  assert.equal((await delUse(A, u.id)).status, 200);
  assert.equal(await stock(A, s), 9);
  const d = await delBuy(A, b.id);
  assert.equal(d.status, 200, JSON.stringify(d.json));
  assert.deepEqual([d.json.current, d.json.remaining], [5, 10]);
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [5, 10]);
  assert.equal(await usageRow(u.id), undefined);
  assert.equal(await purchaseRow(b.id), undefined);
  assert.equal((await delUse(A, u.id)).status, 404);
  // wpisy sprzed POM-02: zużycie oddaje gramy do stanu, wykup nie rusza puli (nie wiadomo, ile z niej zdjął)
  const [lu] = await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${A}, ${s}, 1.5, now() - interval '20 days') RETURNING id`;
  const [lp] = await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, created_at) VALUES (${A}, ${s}, 'Usuwana', 3, now() - interval '20 days') RETURNING id`;
  await delUse(A, lu.id);
  assert.equal(await stock(A, s), 6.5);
  await delBuy(A, lp.id);
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [3.5, 10]);
  // stan nie spada poniżej 0 przy usunięciu wykupu, który już zużyto
  const b2 = await buy(A, s, 20);
  await use(A, s, 23);
  await delBuy(A, b2.id);
  assert.equal(await stock(A, s), 0);
});

test('zakup odmiany usuniętej z bazy: korekta i usunięcie bez zmiany stanu', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Zniknie', producer: 'S-Lab' });
  const b = await buy(A, s, 2);
  await q`UPDATE purchases SET strain_id = NULL WHERE id = ${b.id}`;
  const r = await fixBuy(A, b.id, { grams: 3, pricePerG: 40 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(await purchaseRow(b.id), { grams: 3, cost: 120, day: todayPL() });
  assert.equal(await stock(A, s), 2);
  assert.equal((await delBuy(A, b.id)).status, 200);
  assert.equal(await stock(A, s), 2);
});

test('koszt wykupu: cena za gram albo łączny koszt, proporcja przy zmianie gramów, uzupełnienie brakujących cen', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Bez ceny', producer: 'Aurora', thc: 26, cbd: 1 });
  const b = await buy(A, s, 10);
  assert.equal((await purchaseRow(b.id)).cost, null);
  assert.equal((await fixBuy(A, b.id, { pricePerG: 45 })).json.cost, 450);
  assert.equal((await fixBuy(A, b.id, { cost: 400 })).json.cost, 400);
  assert.equal((await fixBuy(A, b.id, { grams: 5 })).json.cost, 200, 'cena za gram zostaje');
  assert.equal((await fixBuy(A, b.id, { cost: 1, pricePerG: 2 })).status, 400);
  assert.equal((await fixBuy(A, b.id, { pricePerG: -1 })).status, 400);
  assert.equal((await fixBuy(A, b.id, { pricePerG: 9000, grams: 99999 })).status, 400, 'koszt poza zakresem kolumny');

  // trzy zakupy bez ceny i jeden z ceną; wpisanie „Ceny u mnie” proponuje uzupełnienie
  const no = [await buy(A, s, 1), await buy(A, s, 2), await buy(A, s, 2.5)];
  const e = await setEntry(A, s, { price: 45 });
  assert.equal(e.missingCost, 3);
  const f = await call(A, 'history/purchases/fill', 'POST', { strainId: s, pricePerG: 45 });
  assert.equal(f.status, 200, JSON.stringify(f.json));
  assert.equal(f.json.filled, 3);
  assert.deepEqual(await Promise.all(no.map(async (x) => (await purchaseRow(x.id)).cost)), [45, 90, 112.5]);
  assert.equal((await purchaseRow(b.id)).cost, 200, 'zakup z ceną bez zmian');
  assert.equal((await setEntry(A, s, { price: 45 })).missingCost, 0);
  // cudzych zakupów nie uzupełnia
  const bb = await buy(ids.bartek, s, 1);
  await call(A, 'history/purchases/fill', 'POST', { strainId: s, pricePerG: 45 });
  assert.equal((await purchaseRow(bb.id)).cost, null);
  assert.equal((await call(A, 'history/purchases/fill', 'POST', { strainId: s, pricePerG: 0 })).status, 400);
});

test('zmiana daty nie zmienia stanu ani puli; data z przyszłości jest odrzucana', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Data', producer: 'Tilray', thc: 22, cbd: 0 });
  await setEntry(A, s, { current: 10, remaining: 10 });
  const u = await use(A, s, 1);
  const b = await buy(A, s, 2);
  const day = addDaysIso(todayPL(), -3);
  assert.equal((await fixUse(A, u.id, { date: day })).status, 200);
  assert.equal((await fixBuy(A, b.id, { date: day })).status, 200);
  assert.equal((await usageRow(u.id)).day, day);
  assert.equal((await purchaseRow(b.id)).day, day);
  assert.deepEqual([await stock(A, s), await poolOf(A, s)], [11, 8]);
  // przeniesiony wpis nie jest już „świeży”, więc szybkie „Cofnij” go nie usunie
  assert.equal((await call(A, 'strains/[id]/usage', 'DELETE', { id: u.id }, { id: String(s) })).status, 404);
  // dzisiejsza data nie przesuwa wpisu w przyszłość
  assert.equal((await fixUse(A, u.id, { date: todayPL() })).status, 200);
  const [fut] = await q`SELECT created_at > now() AS f FROM usage_log WHERE id = ${u.id}`;
  assert.equal(fut.f, false);
  assert.equal((await fixUse(A, u.id, { date: addDaysIso(todayPL(), 1) })).status, 400);
  assert.equal((await fixUse(A, u.id, { date: '2026-02-30' })).status, 400);
  assert.equal((await fixBuy(A, b.id, { date: 'wczoraj' })).status, 400);
});

test('cudzy wpis: 404 i bez zmian; korekty pacjentów nie trafiają do dziennika admina; eksport pokazuje poprawione wpisy', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Cudza korekta', producer: 'Aurora' });
  await setEntry(A, s, { current: 5 });
  const u = await use(A, s, 1);
  const b = await buy(A, s, 3);
  assert.equal((await fixUse(B, u.id, { grams: 0.5 })).status, 404);
  assert.equal((await delUse(B, u.id)).status, 404);
  assert.equal((await fixBuy(B, b.id, { grams: 1 })).status, 404);
  assert.equal((await delBuy(B, b.id)).status, 404);
  assert.equal((await fixUse(A, 'abc', { grams: 1 })).status, 404);
  assert.equal(await stock(A, s), 7);
  assert.equal((await usageRow(u.id)).grams, 1);
  assert.equal((await purchaseRow(b.id)).grams, 3);

  await fixUse(A, u.id, { grams: 0.5 });
  await fixBuy(A, b.id, { grams: 2, cost: 90 });
  // dane zdrowotne: korekty pacjentów nie trafiają do audit_log (dziennik widoczny dla admina)
  const audit = await q`SELECT 1 FROM audit_log WHERE target IN (${`usage:${u.id}`}, ${`purchase:${b.id}`})`;
  assert.equal(audit.length, 0);

  const ex = await call(A, 'account/export', 'GET');
  assert.equal(ex.status, 200);
  const usage = ex.json.usage.filter((x) => x.strain === 'Cudza korekta');
  const purchases = ex.json.purchases.filter((x) => x.strain === 'Cudza korekta');
  assert.deepEqual(usage.map((x) => x.grams), [0.5]);
  assert.deepEqual(purchases.map((x) => [x.grams, x.cost]), [[2, 90]]);
  await delUse(A, u.id);
  const ex2 = await call(A, 'account/export', 'GET');
  assert.equal(ex2.json.usage.filter((x) => x.strain === 'Cudza korekta').length, 0);
});
