// Bezpieczeństwo: unieważnianie sesji (session_version), limity logowania i zmiany hasła, uprawnienia admina.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const COOKIE = 'zielnik_session';
let q, jar, client, pool, auth;
const ids = {};

// Wywołanie trasy API z bieżącym stanem ciasteczek (jak jedna przeglądarka)
async function req(route, method, body, params = {}) {
  const mod = await import(`../../app/api/${route}/route.js`);
  const r = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](r, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}
// Logowanie w nowej "przeglądarce" z podanego IP; zwraca odpowiedź i token
async function login(username, password, ip = '10.0.0.1') {
  jar.clear();
  client.ip = ip;
  const r = await req('auth/login', 'POST', { username, password });
  return { ...r, token: jar.get(COOKIE) };
}
// Użytkownik, którego wskazuje token (null = sesja nieważna)
async function who(token) {
  jar.clear();
  if (token) jar.set(COOKIE, token);
  return auth.getUser();
}
// Zalogowanie jako dany użytkownik (bez trasy logowania)
async function as(uid) {
  jar.clear();
  await auth.createSession(uid);
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
  for (const n of ['ewa', 'filip', 'gosia', 'henio', 'iga', 'jurek']) {
    jar.clear();
    client.ip = `10.1.0.${Object.keys(ids).length + 1}`;
    const r = await req('auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    ids[n] = (await q`SELECT id FROM users WHERE username = ${n}`)[0].id;
  }
  [{ id: ids.bocian }] = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${ids.bocian}`;
});

after(async () => { if (client) client.ip = '127.0.0.1'; if (pool) await pool.end(); });

test('stary token bez `sv` działa (wersja 0), token z inną wersją nie', { skip }, async () => {
  const { SignJWT } = await import('jose');
  const key = new TextEncoder().encode(process.env.AUTH_SECRET);
  const sign = (p) => new SignJWT(p).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('30d').sign(key);
  const u = await who(await sign({ uid: ids.ewa }));
  assert.equal(u?.id, ids.ewa);
  assert.equal(u.session_version, undefined, 'getUser nie zwraca session_version');
  assert.equal(await who(await sign({ uid: ids.ewa, sv: 5 })), null);
});

test('zmiana hasła: inne urządzenia wylogowane, bieżące dostaje nową sesję', { skip }, async () => {
  const a = await login('filip', 'haslo1234');
  assert.equal(a.status, 200);
  const b = await login('filip', 'haslo1234', '10.0.0.2'); // drugie urządzenie
  jar.clear(); jar.set(COOKIE, b.token);
  const r = await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'nowehaslo1' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const fresh = jar.get(COOKIE);
  assert.notEqual(fresh, b.token);
  assert.equal(await who(a.token), null, 'inne urządzenie wylogowane');
  assert.equal(await who(b.token), null, 'stary token tego urządzenia też nieważny');
  assert.equal((await who(fresh))?.id, ids.filip);
  assert.equal((await login('filip', 'nowehaslo1')).status, 200);
});

test('reset hasła przez admina wylogowuje użytkownika wszędzie', { skip }, async () => {
  const g = await login('gosia', 'haslo1234');
  assert.equal((await who(g.token))?.id, ids.gosia);
  await as(ids.bocian);
  const r = await req('admin/users/[id]', 'PATCH', null, { id: String(ids.gosia) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(await who(g.token), null);
  const t = await login('gosia', r.json.tempPassword);
  assert.equal(t.status, 200);
  assert.equal(t.json.mustChange, true);
});

test('wyloguj ze wszystkich urządzeń', { skip }, async () => {
  const a = await login('henio', 'haslo1234');
  const b = await login('henio', 'haslo1234', '10.0.0.3');
  // zwykłe wylogowanie nie dotyka innych urządzeń
  jar.clear(); jar.set(COOKIE, a.token);
  assert.equal((await req('auth/logout', 'POST')).status, 200);
  assert.equal(jar.get(COOKIE), undefined);
  assert.equal((await who(b.token))?.id, ids.henio);
  // { all: true } unieważnia wszystkie
  const c = await login('henio', 'haslo1234', '10.0.0.4');
  jar.clear(); jar.set(COOKIE, c.token);
  assert.equal((await req('auth/logout', 'POST', { all: true })).status, 200);
  assert.equal(jar.get(COOKIE), undefined);
  assert.equal(await who(b.token), null);
  assert.equal(await who(c.token), null);
  // bez sesji { all: true } też kończy się sukcesem
  jar.clear();
  assert.equal((await req('auth/logout', 'POST', { all: true })).status, 200);
  assert.equal((await login('henio', 'haslo1234')).status, 200);
});

test('DT-14: blokada logowania z obcego IP nie blokuje właściciela', { skip }, async () => {
  for (let i = 0; i < 8; i++) assert.equal((await login('iga', 'zle-haslo', '66.6.6.6')).status, 401);
  assert.equal((await login('iga', 'zle-haslo', '66.6.6.6')).status, 429, 'atakujący zablokowany (para IP+nazwa)');
  assert.equal((await login('iga', 'haslo1234', '66.6.6.6')).status, 429, 'nawet z dobrym hasłem z tego IP');
  const own = await login('IGA', 'haslo1234', '10.9.9.9');
  assert.equal(own.status, 200, 'właściciel z własnego IP loguje się');
  assert.ok(own.token);
  // udany login czyści licznik pary
  for (let i = 0; i < 7; i++) assert.equal((await login('iga', 'zle', '10.9.9.9')).status, 401);
  assert.equal((await login('iga', 'haslo1234', '10.9.9.9')).status, 200);
  assert.equal((await login('iga', 'zle', '10.9.9.9')).status, 401);
});

test('DT-14: limit globalny na nazwę hamuje atak rozproszony, limit per IP zostaje', { skip }, async () => {
  for (let i = 0; i < 50; i++) assert.equal((await login('jurek', 'zle', `172.16.${i}.1`)).status, 401);
  assert.equal((await login('jurek', 'haslo1234', '172.17.0.1')).status, 429);
  await q`DELETE FROM rate_limits`;
  for (let i = 0; i < 30; i++) await login(`nieznany${i}`, 'x', '192.0.2.7');
  assert.equal((await login('ewa', 'haslo1234', '192.0.2.7')).status, 429, 'limit na IP');
  assert.equal((await login('ewa', 'haslo1234', '192.0.2.8')).status, 200);
});

test('zmiana hasła: limit prób i maksymalna długość', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  await as(ids.ewa);
  let r = await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'x'.repeat(101) });
  assert.equal(r.status, 400);
  r = await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'x'.repeat(100) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  for (let i = 0; i < 9; i++) {
    r = await req('auth/change-password', 'POST', { current: 'zle-haslo', password: 'nowehaslo1' });
    assert.equal(r.status, 400);
  }
  r = await req('auth/change-password', 'POST', { current: 'x'.repeat(100), password: 'nowehaslo1' });
  assert.equal(r.status, 429, 'jedenasta próba w oknie zablokowana, nawet z dobrym hasłem');
  const [u] = await q`SELECT password_hash FROM users WHERE id = ${ids.ewa}`;
  const bcrypt = (await import('bcryptjs')).default;
  assert.ok(await bcrypt.compare('x'.repeat(100), u.password_hash), 'hasło bez zmian');
});
