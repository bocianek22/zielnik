// Bezpieczeństwo, cz. 2: „znane urządzenie” przy logowaniu (DT-14), limit prób usunięcia konta, długość haseł,
// import katalogu tylko dla admina, identyfikatory spoza zakresu INT i uprawnienia do wspólnego zdjęcia odmiany.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { png } from './images.mjs';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const COOKIE = 'zielnik_session';
const DEVICE = 'zielnik_device';
const IMG = png('1');
const IMG2 = png('2');
let q, jar, client, pool, auth;
const ids = {};

async function req(route, method, body, params = {}) {
  const mod = await import(`../../app/api/${route}/route.js`);
  const r = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](r, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}
// Logowanie z podanego IP w przeglądarce, która ma (lub nie) ciasteczko urządzenia; zwraca też nowe ciasteczka
async function login(username, password, ip, device) {
  jar.clear();
  if (device) jar.set(DEVICE, device);
  client.ip = ip;
  const r = await req('auth/login', 'POST', { username, password });
  return { ...r, token: jar.get(COOKIE), device: jar.get(DEVICE) };
}
async function who(token) {
  jar.clear();
  if (token) jar.set(COOKIE, token);
  return auth.getUser();
}
async function as(uid) {
  jar.clear();
  await auth.createSession(uid);
}
// Rozproszony atak: 50 błędnych prób z różnych adresów wyczerpuje limit na nazwę
async function exhaustName(name, net) {
  await q`DELETE FROM rate_limits WHERE key = ${`login-user:${name}`}`;
  for (let i = 0; i < 50; i++) assert.equal((await login(name, 'zle-haslo', `${net}.${i}.1`)).status, 401);
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar, client } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  auth = await import('../../lib/auth.js');
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['kasia', 'leon', 'marta', 'nina', 'olek', 'piotr']) {
    jar.clear();
    client.ip = `10.2.0.${Object.keys(ids).length + 1}`;
    const r = await req('auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    ids[n] = (await q`SELECT id FROM users WHERE username = ${n}`)[0].id;
  }
  [{ id: ids.bocian }] = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${ids.bocian}`;
  await q`DELETE FROM rate_limits`;
});

after(async () => { if (client) client.ip = '127.0.0.1'; if (pool) await pool.end(); });

test('DT-14: znane urządzenie omija limit na nazwę, ale nie hasło ani limit pary IP+nazwa', { skip }, async () => {
  const first = await login('kasia', 'haslo1234', '10.3.0.1');
  assert.equal(first.status, 200);
  assert.ok(first.device, 'udane logowanie wystawia ciasteczko urządzenia');
  const other = (await login('leon', 'haslo1234', '10.3.0.2')).device;

  await exhaustName('kasia', '172.20');
  assert.equal((await login('kasia', 'haslo1234', '10.3.0.9')).status, 429, 'obca przeglądarka: limit na nazwę');
  assert.equal((await login('kasia', 'haslo1234', '10.3.0.9', other)).status, 429, 'ciasteczko innego konta nie pomaga');
  assert.equal((await login('kasia', 'zle-haslo', '10.3.0.1', first.device)).status, 401, 'hasło nadal wymagane');
  const own = await login('KASIA', 'haslo1234', '10.3.0.1', first.device);
  assert.equal(own.status, 200, 'właściciel w swojej przeglądarce loguje się mimo ataku');
  assert.equal((await who(own.token))?.id, ids.kasia);
  // próby ze znanego urządzenia nie zużywają limitu na nazwę
  const [c] = await q`SELECT n FROM rate_limits WHERE key = 'login-user:kasia'`;
  assert.equal(c.n, 52, '50 prób ataku + 2 próby bez znanego urządzenia');
  // limit pary IP+nazwa działa też dla znanego urządzenia (skradzione ciasteczko nie daje nieograniczonych prób)
  for (let i = 0; i < 8; i++) assert.equal((await login('kasia', 'zle', '10.3.0.5', own.device)).status, 401);
  assert.equal((await login('kasia', 'haslo1234', '10.3.0.5', own.device)).status, 429);
});

test('DT-14: ciasteczko urządzenia nie jest sesją i nie da się go podrobić tokenem sesji', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  const r = await login('marta', 'haslo1234', '10.4.0.1');
  assert.equal(await who(r.device), null, 'ciasteczko urządzenia nie loguje');
  jar.clear(); jar.set(DEVICE, r.device);
  assert.equal(await auth.getUser(), null, 'samo ciasteczko urządzenia bez sesji = brak użytkownika');
  assert.deepEqual(await auth.knownDevice(), { uid: ids.marta, sv: 0 });
  // token sesji ani token podpisany kluczem sesji z `aud` urządzenia nie są ważnym ciasteczkiem urządzenia
  jar.clear(); jar.set(DEVICE, r.token);
  assert.equal(await auth.knownDevice(), null);
  const { SignJWT } = await import('jose');
  const key = new TextEncoder().encode(process.env.AUTH_SECRET);
  const forged = await new SignJWT({ uid: ids.marta, sv: 0 }).setProtectedHeader({ alg: 'HS256' })
    .setAudience('zielnik:device').setExpirationTime('1d').sign(key);
  jar.clear(); jar.set(DEVICE, forged);
  assert.equal(await auth.knownDevice(), null);
  assert.equal(await who(forged), null, 'token z `aud` nie jest sesją');
  await exhaustName('marta', '172.21');
  assert.equal((await login('marta', 'haslo1234', '10.4.0.2', forged)).status, 429);
  assert.equal((await login('marta', 'haslo1234', '10.4.0.2', r.token)).status, 429);
  assert.equal((await login('marta', 'haslo1234', '10.4.0.2', r.device)).status, 200);
});

test('DT-14: „wyloguj wszędzie” i zmiana hasła odbierają status znanego urządzenia', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  const a = await login('nina', 'haslo1234', '10.5.0.1');
  const b = await login('nina', 'haslo1234', '10.5.0.2');
  // zwykłe wylogowanie zostawia ciasteczko urządzenia ważne
  jar.clear(); jar.set(COOKIE, a.token); jar.set(DEVICE, a.device);
  assert.equal((await req('auth/logout', 'POST')).status, 200);
  assert.equal(jar.get(DEVICE), a.device);
  await exhaustName('nina', '172.22');
  assert.equal((await login('nina', 'haslo1234', '10.5.0.1', a.device)).status, 200);
  // wyloguj wszędzie (z urządzenia B) unieważnia ciasteczko urządzenia A
  jar.clear(); jar.set(COOKIE, b.token);
  assert.equal((await req('auth/logout', 'POST', { all: true })).status, 200);
  assert.equal((await login('nina', 'haslo1234', '10.5.0.1', a.device)).status, 429);
  // zmiana hasła: bieżące urządzenie dostaje nowe ciasteczko, stare przestaje działać
  await q`DELETE FROM rate_limits`;
  const c = await login('nina', 'haslo1234', '10.5.0.3');
  jar.clear(); jar.set(COOKIE, c.token); jar.set(DEVICE, c.device);
  assert.equal((await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'noweHaslo99' })).status, 200);
  const fresh = jar.get(DEVICE);
  assert.ok(fresh && fresh !== c.device);
  await exhaustName('nina', '172.23');
  assert.equal((await login('nina', 'noweHaslo99', '10.5.0.3', c.device)).status, 429);
  assert.equal((await login('nina', 'noweHaslo99', '10.5.0.3', fresh)).status, 200);
});

test('logowanie: bardzo długie hasło odrzucone bez bcrypt', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  assert.equal((await login('olek', 'x'.repeat(1001), '10.6.0.1')).status, 401);
  assert.equal((await login('olek', 'haslo1234', '10.6.0.1')).status, 200);
});

test('usunięcie konta: limit prób hasła i górna granica długości', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  await as(ids.piotr);
  assert.equal((await req('account', 'DELETE', { password: 'x'.repeat(1001) })).status, 403);
  for (let i = 0; i < 4; i++) {
    const r = await req('account', 'DELETE', { password: 'zle-haslo' });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, 'Nieprawidłowe hasło.');
  }
  const r = await req('account', 'DELETE', { password: 'haslo1234' });
  assert.equal(r.status, 429, 'szósta próba w oknie zablokowana, nawet z dobrym hasłem');
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${ids.piotr}`)[0].n, 1, 'konto istnieje');
  await q`DELETE FROM rate_limits WHERE key = ${`delete-account:${ids.piotr}`}`;
  assert.equal((await req('account', 'DELETE', { password: 'haslo1234' })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${ids.piotr}`)[0].n, 0);
});

test('admin tworzy konto: hasło tymczasowe od 8 do 100 znaków', { skip }, async () => {
  await as(ids.bocian);
  let r = await req('admin/users', 'POST', { username: 'dlugie1', password: 'x'.repeat(101) });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'Hasło tymczasowe musi mieć od 8 do 100 znaków.');
  r = await req('admin/users', 'POST', { username: 'krotkie1', password: 'x'.repeat(7) });
  assert.equal(r.status, 400);
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE username IN ('dlugie1', 'krotkie1')`)[0].n, 0);
  r = await req('admin/users', 'POST', { username: 'dlugie2', password: 'x'.repeat(100) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
});

test('import katalogu (POST /api/catalog) tylko dla admina, komunikaty bez zmian', { skip }, async () => {
  await as(ids.kasia);
  let r = await req('catalog', 'POST', { rows: [{ producent: 'X', odmiana: 'Y' }] });
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'Tylko admin może wczytać katalog.');
  assert.equal((await req('catalog', 'GET')).status, 200, 'lista dla każdego zalogowanego');
  jar.clear();
  assert.equal((await req('catalog', 'POST', { rows: [] })).status, 401);
  await q`UPDATE users SET must_change_password = TRUE WHERE id = ${ids.bocian}`;
  await as(ids.bocian);
  assert.equal((await req('catalog', 'POST', { rows: [] })).json.error, 'Najpierw ustaw nowe hasło.');
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${ids.bocian}`;
  r = await req('catalog', 'POST', { rows: [] });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'Brak wierszy do wczytania.');
  assert.equal((await q`SELECT count(*)::int AS n FROM market_catalog`)[0].n, 0);
});

test('intId (strony i trasy): liczby spoza zakresu INT dają 0 zamiast błędu SQL', { skip }, async () => {
  const { intId } = await import('../../lib/ids.js');
  const guard = await import('../../lib/guard.js');
  assert.equal(guard.intId, intId);
  assert.equal(intId('2147483647'), 2147483647);
  for (const v of ['2147483648', '99999999999', '-1', '0', '1.5', 'abc', '', undefined]) assert.equal(intId(v), 0, String(v));
  // tak jak strony: wynik idzie do zapytania i daje brak wiersza (404), a surowe Number() dawało błąd SQL
  assert.equal((await q`SELECT 1 FROM strains WHERE id = ${intId('2147483648')}`).length, 0);
  await assert.rejects(q`SELECT 1 FROM strains WHERE id = ${Number('2147483648')}`);
});

test('wspólne zdjęcie odmiany: dodać może każdy, podmienić/usunąć dodający, autor odmiany lub admin', { skip }, async () => {
  const { kasia: A, leon: B, marta: C, bocian: ADM } = ids;
  const [{ id: S }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('P', 'Foto', 'x', ${A}) RETURNING id`;
  const p = { id: String(S) };
  const photo = async () => (await q`SELECT data, uploaded_by FROM strain_photos WHERE strain_id = ${S}`)[0];

  await as(B);
  assert.equal((await req('strains/[id]/photo', 'PUT', { image: IMG }, p)).status, 200, 'brak zdjęcia: każdy może dodać');
  assert.equal((await photo()).uploaded_by, B);
  await as(C);
  let r = await req('strains/[id]/photo', 'PUT', { image: IMG2 }, p);
  assert.equal(r.status, 403);
  assert.match(r.json.error, /tylko osoba, która je dodała/);
  assert.equal((await req('strains/[id]/photo', 'DELETE', null, p)).status, 403);
  assert.equal((await photo()).data, IMG.split(',')[1], 'zdjęcie bez zmian');
  await as(B);
  assert.equal((await req('strains/[id]/photo', 'PUT', { image: IMG2 }, p)).status, 200, 'dodający może podmienić');
  await as(A);
  assert.equal((await req('strains/[id]/photo', 'PUT', { image: IMG }, p)).status, 200, 'autor odmiany może podmienić');
  assert.equal((await photo()).uploaded_by, A);
  await as(B);
  assert.equal((await req('strains/[id]/photo', 'DELETE', null, p)).status, 403, 'po podmianie B nie jest już dodającym');
  await as(ADM);
  assert.equal((await req('strains/[id]/photo', 'DELETE', null, p)).status, 200, 'admin może usunąć');
  assert.equal(await photo(), undefined);
  assert.equal((await req('strains/[id]/photo', 'DELETE', null, p)).status, 200, 'usunięcie nieistniejącego zdjęcia: ok');

  // zdjęcie sprzed kolumny uploaded_by: tylko autor odmiany lub admin
  await q`INSERT INTO strain_photos (strain_id, mime, data) VALUES (${S}, 'image/png', 'c3RhcmU=')`;
  await as(B);
  assert.equal((await req('strains/[id]/photo', 'PUT', { image: IMG }, p)).status, 403);
  assert.equal((await req('strains/[id]/photo', 'DELETE', null, p)).status, 403);
  await as(A);
  assert.equal((await req('strains/[id]/photo', 'DELETE', null, p)).status, 200);
  // nieistniejąca odmiana i identyfikator spoza zakresu
  assert.equal((await req('strains/[id]/photo', 'PUT', { image: IMG }, { id: '2147483648' })).status, 404);

  // eksport danych zawiera zdjęcia dodane przez użytkownika; po usunięciu konta zdjęcie zostaje bez autora
  await as(C);
  assert.equal((await req('strains/[id]/photo', 'PUT', { image: IMG }, p)).status, 200);
  const exp = await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export?photos=1'));
  const data = JSON.parse(await exp.text());
  assert.equal(data.strainPhotosAdded.length, 1);
  assert.equal(data.strainPhotosAdded[0].strain, 'Foto');
  assert.equal(data.strainPhotosAdded[0].photo_base64, IMG.split(',')[1]);
  await q`DELETE FROM users WHERE id = ${C}`;
  assert.equal((await photo()).uploaded_by, null);
});

test('migracja uploaded_by jest idempotentna', { skip }, async () => {
  await pool.query(`ALTER TABLE strain_photos ADD COLUMN IF NOT EXISTS uploaded_by INT REFERENCES users(id) ON DELETE SET NULL`);
  const r = await pool.query(`SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = 'strain_photos'::regclass AND contype = 'f'`);
  assert.equal(r.rows[0].n, 2, 'jeden klucz obcy na strains i jeden na users');
});
