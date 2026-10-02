// Testy integracyjne z prawdziwym PostgreSQL: schemat (ensureDb), widoczność (can_see) i trasy API.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
// Bez TEST_DATABASE_URL testy są pomijane.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, listStrains;
const ids = {};

// Wywołanie trasy API jako zalogowany użytkownik
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
  ({ listStrains } = await import('../../lib/strains.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek', 'celina', 'darek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('ensureDb jest idempotentne (drugie uruchomienie bez błędów)', { skip }, async () => {
  const { ensureDb } = await import('../../lib/db.js');
  await ensureDb();
  const [r] = await q`SELECT count(*)::int AS n FROM users WHERE lower(username) = 'bocian' AND is_admin`;
  assert.equal(r.n, 1);
});

test('widoczność wpisów: tylko ja / znajomi / znajomi znajomych / blokada', { skip }, async () => {
  const { ania: A, bartek: B, celina: C, darek: D } = ids;
  // A-B i B-C są znajomymi, więc C jest "znajomym znajomego" dla A; D nie zna nikogo
  for (const [x, y] of [[A, B], [B, C]]) {
    assert.equal((await call(x, 'friends', 'POST', { action: 'request', userId: y })).status, 200);
    assert.equal((await call(y, 'friends', 'POST', { action: 'accept', userId: x })).status, 200);
  }
  const s = (await call(A, 'strains', 'POST', { name: 'Widoczna', producer: 'Aurora', type: 'haze' })).json.id;
  for (const [u, visibility, rating] of [[A, 'me', 8], [B, 'friends', 7], [C, 'fof', 6], [D, 'all', 5]]) {
    assert.equal((await call(u, 'strains/[id]/entry', 'PUT', { rating, visibility }, { id: String(s) })).status, 200);
  }
  const sees = async (viewer) => (await listStrains(viewer)).find((x) => x.id === s).entries
    .filter((e) => e.rating != null).map((e) => e.username).sort();
  assert.deepEqual(await sees(A), ['ania', 'bartek', 'celina', 'darek']);
  assert.deepEqual(await sees(B), ['bartek', 'celina', 'darek']);
  assert.deepEqual(await sees(D), ['darek']);
  // stan i "do wykupienia" innych osób nigdy nie wychodzą poza właściciela
  const other = (await listStrains(A)).find((x) => x.id === s).entries.find((e) => e.username === 'bartek');
  assert.equal(other.current, null);
  assert.equal(other.remaining, null);
  // blokada w dowolną stronę ukrywa wszystko
  await call(C, 'blocks', 'POST', { action: 'block', userId: A });
  assert.deepEqual(await sees(A), ['ania', 'bartek', 'darek']);
  await call(C, 'blocks', 'POST', { action: 'unblock', userId: A });
});

test('równoległe zapisy zużycia i wykupu nie gubią się', { skip }, async () => {
  const A = ids.ania;
  const s = (await call(A, 'strains', 'POST', { name: 'Wyścig', producer: 'Tilray', type: 'kush' })).json.id;
  await call(A, 'strains/[id]/entry', 'PUT', { current: 10 }, { id: String(s) });
  const usage = await import('../../app/api/strains/[id]/usage/route.js');
  const purchase = await import('../../app/api/strains/[id]/purchase/route.js');
  jar.clear();
  await createSession(A);
  const req = () => new Request('http://localhost/', { method: 'POST', body: JSON.stringify({ grams: 1 }) });
  const params = { params: Promise.resolve({ id: String(s) }) };
  await Promise.all(Array.from({ length: 6 }, () => usage.POST(req(), params)));
  const stock = async () => Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${s} AND user_id = ${A}`)[0].current_amount);
  assert.equal(await stock(), 4);
  await Promise.all(Array.from({ length: 6 }, () => purchase.POST(req(), params)));
  assert.equal(await stock(), 10);
  const r = await call(A, 'strains/[id]/usage', 'POST', { grams: 25 }, { id: String(s) });
  assert.deepEqual(r.json, { current: 0, used: 25, stockShort: true });
});

test('twórca nie usunie odmiany, której używają inni; admin może', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = (await call(A, 'strains', 'POST', { name: 'Wspólna', producer: 'S-Lab', type: 'haze' })).json.id;
  await call(B, 'strains/[id]/usage', 'POST', { grams: 1 }, { id: String(s) });
  assert.equal((await call(A, 'strains/[id]', 'DELETE', null, { id: String(s) })).status, 409);
  assert.equal((await call(B, 'strains/[id]', 'DELETE', null, { id: String(s) })).status, 403);
  const [admin] = await q`SELECT id FROM users WHERE is_admin`;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${admin.id}`;
  assert.equal((await call(admin.id, 'strains/[id]', 'DELETE', null, { id: String(s) })).status, 200);
  // własną, nieużywaną przez innych odmianę twórca usuwa
  const own = (await call(A, 'strains', 'POST', { name: 'Moja', producer: 'S-Lab', type: 'haze' })).json.id;
  await call(A, 'strains/[id]/usage', 'POST', { grams: 1 }, { id: String(own) });
  assert.equal((await call(A, 'strains/[id]', 'DELETE', null, { id: String(own) })).status, 200);
});

test('ochrona usuwania obejmuje też zakupy i "do wykupienia" innych osób', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const bought = (await call(A, 'strains', 'POST', { name: 'Kupiona', producer: 'S-Lab', type: 'haze' })).json.id;
  await call(B, 'strains/[id]/purchase', 'POST', { grams: 2 }, { id: String(bought) });
  await call(B, 'strains/[id]/usage', 'POST', { grams: 2 }, { id: String(bought) });
  await q`DELETE FROM usage_log WHERE strain_id = ${bought}`; // zostaje tylko historia zakupu
  assert.equal((await call(A, 'strains/[id]', 'DELETE', null, { id: String(bought) })).status, 409);
  // odmiana bez THC ma własną pulę 'strain:<id>'
  const planned = (await call(A, 'strains', 'POST', { name: 'Planowana', producer: 'S-Lab', type: 'haze' })).json.id;
  await call(B, 'strains/[id]/entry', 'PUT', { remaining: 5 }, { id: String(planned) });
  assert.equal((await call(A, 'strains/[id]', 'DELETE', null, { id: String(planned) })).status, 409);
});

test('błędny identyfikator w adresie daje 404, a nie błąd serwera', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(A, 'strains/[id]', 'PATCH', { name: 'x', producer: 'Aurora', type: 'haze' }, { id: 'abc' })).status, 404);
  assert.equal((await call(A, 'strains/[id]/photo', 'GET', null, { id: 'abc' })).status, 404);
  assert.equal((await call(A, 'tests/[tid]', 'DELETE', null, { tid: '1.5' })).status, 404);
  assert.equal((await call(A, 'strains/[id]/usage', 'POST', { grams: 1 }, { id: '99999999999' })).status, 404);
});

test('podstawowe trasy odpowiadają bez błędów SQL', { skip }, async () => {
  const A = ids.ania;
  const s = (await call(A, 'strains', 'POST', { name: 'Trasy', producer: 'Aurora', type: 'haze', thc: 20, cbd: 1 })).json.id;
  await call(A, 'strains/[id]/purchase', 'POST', { grams: 5 }, { id: String(s) });
  await call(A, 'prescriptions', 'POST', { issuedOn: '2026-01-01', validUntil: '2026-12-31', grams: 30 });
  await call(A, 'symptoms', 'PUT', { day: '2026-01-02', pain: 3, sleep: 6, anxiety: 2, mood: 7 });
  await call(A, 'strains/[id]/tests', 'POST', { note: 'opis' }, { id: String(s) });
  for (const route of ['strains', 'prescriptions', 'symptoms', 'friends', 'groups', 'notifications', 'export', 'account/export', 'catalog']) {
    const r = await call(A, route, 'GET');
    assert.equal(r.status, 200, `${route}: ${JSON.stringify(r.json)}`);
  }
  const errors = await q`SELECT path, message FROM error_log`;
  assert.deepEqual(errors, []);
});

test('autozapis pól bez ilości nie nadpisuje stanu zmienionego szybką akcją', { skip }, async () => {
  const A = ids.ania;
  const s = (await call(A, 'strains', 'POST', { name: 'Autozapis', producer: 'Aurora', type: 'haze' })).json.id;
  await call(A, 'strains/[id]/entry', 'PUT', { current: 10, remaining: 5 }, { id: String(s) });
  await call(A, 'strains/[id]/usage', 'POST', { grams: 3 }, { id: String(s) });
  // spóźniony autozapis notatki (bez current/remaining) nie może przywrócić 10 g ani wyzerować "do wykupienia"
  const r = await call(A, 'strains/[id]/entry', 'PUT', { notes: 'nowa notatka', rating: 8 }, { id: String(s) });
  assert.equal(r.status, 200);
  assert.equal(r.json.entry.current, undefined, 'niewysłanego stanu nie odsyłamy');
  const own = (await listStrains(A, { ids: [s] }))[0].entries.find((e) => e.userId === A);
  assert.equal(Number(own.current), 7);
  assert.equal(Number(own.remaining), 5);
  assert.equal(own.notes, 'nowa notatka');
});

test('porównanie i listStrains: identyfikatory spoza zakresu INT są pomijane zamiast błędu SQL', { skip }, async () => {
  assert.deepEqual(await listStrains(ids.ania, { ids: [99999999999, 'abc'] }), []);
});
