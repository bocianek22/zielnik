// Historia zmian odmian (strain_edits): zapis różnicy przy PATCH, odczyt, prywatność i przywracanie przez admina.
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
  await q`UPDATE users SET must_change_password = FALSE WHERE is_admin`;
  for (const n of ['ania', 'bartek', 'celina']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

const hist = async (uid, id) => (await call(uid, 'strains/[id]/history', 'GET', null, { id: String(id) })).json.history;
const edits = async (id) => (await q`SELECT user_id, changes FROM strain_edits WHERE strain_id = ${id} ORDER BY id`);

test('edycja zapisuje wpis z różnicą pól; brak zmian = brak wpisu', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Historia', producer: 'Aurora', thc: 20, cbd: 1 });
  assert.equal((await edits(s)).length, 0);
  await edit(B, s, { name: 'Historia', producer: 'Aurora', thc: 20, cbd: 1 });
  assert.equal((await edits(s)).length, 0, 'identyczne dane nie tworzą wpisu');
  await edit(B, s, { name: 'Historia 2', producer: 'Aurora', thc: 20, cbd: 1, terpenes: ['Limonen'], expires: '2027-01-31' });
  const e = await edits(s);
  assert.equal(e.length, 1);
  assert.equal(e[0].user_id, B);
  assert.deepEqual(Object.keys(e[0].changes).sort(), ['expires_on', 'name', 'terpenes']);
  assert.deepEqual(e[0].changes.name, ['Historia', 'Historia 2']);
  assert.deepEqual(e[0].changes.terpenes, [[], ['Limonen']]);
  assert.deepEqual(e[0].changes.expires_on, [null, '2027-01-31']);
});

test('historia: nazwa edytującego wg widoczności jego profilu, blokada ukrywa nazwę, 404 dla nieznanej odmiany', { skip }, async () => {
  const { ania: A, bartek: B, celina: C } = ids;
  const s = await create(A, { name: 'Widoczność historii', producer: 'Aurora', thc: 10 });
  await edit(B, s, { name: 'Widoczność historii', producer: 'Aurora', thc: 11 });
  const h = await hist(C, s);
  assert.equal(h.length, 1);
  assert.equal(h[0].who, 'ktoś', 'profil domyślnie dla znajomych: obcy nie widzi, kto edytował (dane zdrowotne)');
  assert.equal(h[0].mine, false);
  await q`UPDATE users SET profile_visibility = 'all' WHERE id = ${B}`;
  assert.equal((await hist(C, s))[0].who, 'bartek', 'profil publiczny: nazwa widoczna');
  assert.deepEqual(h[0].changes.thc, [10, 11]);
  assert.match(h[0].at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  assert.equal((await hist(B, s))[0].mine, true);
  await call(C, 'blocks', 'POST', { action: 'block', userId: B });
  assert.equal((await hist(C, s))[0].who, 'ktoś', 'blokujący nie widzi nazwy zablokowanego');
  assert.equal((await hist(B, s))[0].who, 'bartek', 'własna edycja widoczna dla autora');
  assert.equal((await hist(A, s))[0].who, 'bartek');
  assert.equal((await call(C, 'strains/[id]/history', 'GET', null, { id: '999999' })).status, 404);
  assert.equal((await call(null, 'strains/[id]/history', 'GET', null, { id: String(s) })).status, 401);
  await call(C, 'blocks', 'POST', { action: 'unblock', userId: B });
});

test('admin przywraca stare wartości (z przeniesieniem puli), zwykły użytkownik nie może', { skip }, async () => {
  const { ania: A, bartek: B, Bocian: ADMIN } = ids;
  const s = await create(A, { name: 'Przywracana', producer: 'Tilray', thc: 20, cbd: 1 });
  await call(A, 'strains/[id]/entry', 'PUT', { remaining: 7 }, { id: String(s) });
  await edit(B, s, { name: 'Przywracana', producer: 'Tilray', thc: 25, cbd: 1, taste: 'cytryna' });
  assert.equal(Number((await listStrains(A)).find((x) => x.id === s).entries.find((e) => e.userId === A).remaining), 7);
  const [e1] = await hist(A, s);
  assert.deepEqual(Object.keys(e1.changes).sort(), ['taste', 'thc']);

  const denied = await call(B, 'strains/[id]/history', 'POST', { editId: e1.id }, { id: String(s) });
  assert.equal(denied.status, 403);
  assert.equal((await edits(s)).length, 1);

  // równoległa zmiana innego pola nie może zostać cofnięta przez przywrócenie
  await edit(B, s, { name: 'Przywracana nowa', producer: 'Tilray', thc: 25, cbd: 1, taste: 'cytryna' });
  assert.equal((await call(ADMIN, 'strains/[id]/history', 'POST', { editId: 999999 }, { id: String(s) })).status, 404);
  const r = await call(ADMIN, 'strains/[id]/history', 'POST', { editId: e1.id }, { id: String(s) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const cur = (await listStrains(A)).find((x) => x.id === s);
  assert.equal(cur.thc, 20);
  assert.equal(cur.taste, '');
  assert.equal(cur.name, 'Przywracana nowa');
  assert.equal(cur.cbd, 1);
  assert.equal(Number(cur.entries.find((e) => e.userId === A).remaining), 7, 'pula przeszła z powrotem na klucz THC 20');
  assert.deepEqual((await q`SELECT user_id FROM user_pool WHERE pool_key = ${cur.pool_key}`).map((x) => x.user_id), [A]);
  const h = await hist(A, s);
  assert.equal(h.length, 3);
  assert.equal(h[0].who, 'ktoś', 'admin z profilem dla znajomych też jest ukryty przed obcymi');
  assert.equal((await hist(ADMIN, s))[0].who, 'Bocian');
  assert.deepEqual(h[0].changes.thc, [25, 20]);
});

test('wpisy historii znikają razem z odmianą, a usunięcie autora zostawia wpis anonimowy', { skip }, async () => {
  const { ania: A, celina: C } = ids;
  const s = await create(A, { name: 'Do usunięcia', producer: 'Aurora', thc: 5 });
  await edit(C, s, { name: 'Do usunięcia 2', producer: 'Aurora', thc: 5 });
  await q`DELETE FROM users WHERE id = ${C}`;
  assert.equal((await edits(s))[0].user_id, null);
  assert.equal((await hist(A, s))[0].who, 'ktoś');
  await q`DELETE FROM strains WHERE id = ${s}`;
  assert.equal((await edits(s)).length, 0);
});
