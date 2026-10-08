// KON-1: adres e-mail konta, weryfikacja i odzyskiwanie hasła (z atrapą wysyłki).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const COOKIE = 'zielnik_session';
const APP = 'https://zielnik.example';
const ENV = { RESEND_API_KEY: 're_test', MAIL_FROM: 'Notatnik <n@example.test>', APP_URL: APP };
let q, jar, client, pool, auth, mail, acct;
const ids = {};
const outbox = [];

async function req(route, method, body, params = {}) {
  const mod = await import(`../../app/api/${route}/route.js`);
  const r = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](r, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  await mail.flushBackground();
  return { status: res.status, json };
}
let ipN = 0;
const freshIp = () => { client.ip = `10.9.${Math.floor(++ipN / 250)}.${ipN % 250}`; };
async function login(username, password = 'haslo1234') {
  jar.clear();
  freshIp();
  const r = await req('auth/login', 'POST', { username, password });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return jar.get(COOKIE);
}
const use = (token) => { jar.clear(); if (token) jar.set(COOKIE, token); };
const tokenFrom = (m) => m.text.match(/#t=([A-Za-z0-9_-]{43})/)[1];
const forgot = (login) => { jar.clear(); freshIp(); return req('auth/forgot', 'POST', { login }); };
// Dodanie i potwierdzenie adresu przez API (jak w profilu i z linku)
async function addVerified(name, email) {
  use(await login(name));
  outbox.length = 0;
  const r = await req('account/email', 'PUT', { email, consent: true, password: 'haslo1234' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(outbox.length, 1);
  jar.clear();
  const v = await req('account/email/verify', 'POST', { token: tokenFrom(outbox[0]) });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  outbox.length = 0;
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  Object.assign(process.env, ENV);
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar, client } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  auth = await import('../../lib/auth.js');
  mail = await import('../../lib/mail.js');
  acct = await import('../../lib/account-email.js');
  mail.setMailTransport(async (m) => { outbox.push(m); });
  acct.setResponseFloor(0);
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 20)`;
  for (const n of ['ala', 'bob', 'cela', 'darek', 'ela', 'franek', 'gosia', 'henio']) {
    jar.clear();
    freshIp();
    const r = await req('auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    ids[n] = (await q`SELECT id FROM users WHERE username = ${n}`)[0].id;
  }
});

after(async () => {
  if (mail) mail.setMailTransport(null);
  for (const k of Object.keys(ENV)) delete process.env[k];
  delete process.env.APP_HOSTS;
  if (client) Object.assign(client, { ip: '127.0.0.1', ua: null, country: null, host: null });
  if (pool) await pool.end();
});

test('bez RESEND_API_KEY i MAIL_FROM: funkcja ukryta, trasy odpowiadają 503 z komunikatem', { skip }, async () => {
  delete process.env.RESEND_API_KEY;
  try {
    use(await login('bob'));
    const g = await req('account/email', 'GET');
    assert.equal(g.json.enabled, false);
    const p = await req('account/email', 'PUT', { email: 'bob@example.test', consent: true, password: 'haslo1234' });
    assert.equal(p.status, 503);
    assert.equal(p.json.disabled, true);
    assert.match(p.json.error, /nie jest skonfigurowana/);
    const f = await forgot('bob');
    assert.equal(f.status, 503);
    assert.equal(f.json.disabled, true);
    assert.equal(outbox.length, 0);
  } finally {
    process.env.RESEND_API_KEY = ENV.RESEND_API_KEY;
  }
});

test('dodanie adresu: wymaga zgody, hasła i poprawnego adresu; link weryfikacyjny jednorazowy, w bazie tylko skrót', { skip }, async () => {
  use(await login('ala'));
  outbox.length = 0;
  assert.equal((await req('account/email', 'PUT', { email: 'ala@example.test', password: 'haslo1234' })).status, 400);
  assert.equal((await req('account/email', 'PUT', { email: 'nie-adres', consent: true, password: 'haslo1234' })).status, 400);
  assert.equal((await req('account/email', 'PUT', { email: 'a b@example.test', consent: true, password: 'haslo1234' })).status, 400);
  assert.equal((await req('account/email', 'PUT', { email: 'ala@example.test', consent: true, password: 'zle-haslo' })).status, 403);
  assert.equal(outbox.length, 0);
  const r = await req('account/email', 'PUT', { email: '  Ala@Example.TEST ', consent: true, password: 'haslo1234' });
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.email, r.json.verified], ['ala@example.test', false]);
  assert.equal(outbox.length, 1);
  const m = outbox[0];
  assert.equal(m.to, 'ala@example.test');
  assert.ok(m.text.includes(`${APP}/potwierdz-email#t=`), m.text);
  const token = tokenFrom(m);
  const rows = await q`SELECT token_hash, email, purpose, expires_at - created_at AS ttl FROM email_tokens WHERE user_id = ${ids.ala}`;
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].token_hash, token);
  assert.equal(JSON.stringify(rows).includes(token), false, 'surowy token nie może być w bazie');
  assert.equal(rows[0].purpose, 'verify');
  const g = await req('account/email', 'GET');
  assert.deepEqual([g.json.enabled, g.json.email, g.json.verified], [true, 'ala@example.test', false]);
  assert.ok(g.json.consentAt);
  // potwierdzenie bez logowania (link otwarty na innym urządzeniu)
  jar.clear();
  assert.equal((await req('account/email/verify', 'POST', { token })).status, 200);
  assert.equal((await req('account/email/verify', 'POST', { token })).status, 400, 'drugi raz ten sam link nie działa');
  assert.equal((await req('account/email/verify', 'POST', { token: 'x'.repeat(43) })).status, 400);
  const [u] = await q`SELECT email, email_verified_at FROM users WHERE id = ${ids.ala}`;
  assert.equal(u.email, 'ala@example.test');
  assert.ok(u.email_verified_at);
});

test('zmiana adresu wymaga ponownej weryfikacji; stary link przestaje działać; usunięcie czyści adres i zgodę', { skip }, async () => {
  use(await login('darek'));
  outbox.length = 0;
  await req('account/email', 'PUT', { email: 'darek1@example.test', consent: true, password: 'haslo1234' });
  const old = tokenFrom(outbox[0]);
  await req('account/email', 'PUT', { email: 'darek2@example.test', consent: true, password: 'haslo1234' });
  assert.equal(outbox.length, 2);
  jar.clear();
  assert.equal((await req('account/email/verify', 'POST', { token: old })).status, 400, 'link na poprzedni adres nieważny');
  assert.equal((await req('account/email/verify', 'POST', { token: tokenFrom(outbox[1]) })).status, 200);
  // zmiana potwierdzonego adresu: z powrotem niepotwierdzony
  use(await login('darek'));
  const r = await req('account/email', 'PUT', { email: 'darek3@example.test', consent: true, password: 'haslo1234' });
  assert.equal(r.json.verified, false);
  assert.equal((await q`SELECT email_verified_at FROM users WHERE id = ${ids.darek}`)[0].email_verified_at, null);
  const d = await req('account/email', 'DELETE');
  assert.equal(d.status, 200);
  const [u] = await q`SELECT email, email_verified_at, email_consent_at FROM users WHERE id = ${ids.darek}`;
  assert.deepEqual(u, { email: null, email_verified_at: null, email_consent_at: null });
  assert.equal((await q`SELECT count(*)::int AS n FROM email_tokens WHERE user_id = ${ids.darek}`)[0].n, 0);
});

test('„Nie pamiętam hasła” nie zdradza konta ani adresu: ta sama odpowiedź, mail tylko na potwierdzony adres', { skip }, async () => {
  // cela: adres niepotwierdzony; bob: bez adresu; Bocian: admin z potwierdzonym adresem
  use(await login('cela'));
  await req('account/email', 'PUT', { email: 'cela@example.test', consent: true, password: 'haslo1234' });
  await q`UPDATE users SET email = 'admin@example.test', email_verified_at = now() WHERE lower(username) = 'bocian'`;
  outbox.length = 0;
  const cases = ['nikt-taki', 'nikt@example.test', 'bob', 'cela', 'cela@example.test', 'bocian', 'admin@example.test'];
  const out = [];
  for (const c of cases) out.push(await forgot(c));
  assert.equal(outbox.length, 0, 'brak wysyłki dla kont bez potwierdzonego adresu i dla admina');
  const ok = await forgot('ALA');
  const byMail = await forgot('ala@example.test');
  assert.equal(outbox.length, 2);
  for (const r of [...out, byMail]) {
    assert.equal(r.status, ok.status);
    assert.deepEqual(r.json, ok.json);
  }
  assert.equal(ok.status, 200);
  assert.match(ok.json.message, /Jeśli konto ma potwierdzony adres/);
  assert.equal(outbox[0].to, 'ala@example.test');
  assert.ok(outbox[1].text.includes(`${APP}/nowe-haslo#t=`));
  assert.ok(outbox[1].text.includes('„ala”'));
  // poprzedni link resetu traci ważność, gdy wysłano nowszy
  jar.clear();
  assert.equal((await req('auth/reset', 'POST', { token: tokenFrom(outbox[0]), password: 'nowehaslo1' })).status, 400);
  // limit konta po cichu: ta sama odpowiedź, bez maila (3 na godzinę na konto)
  outbox.length = 0;
  await forgot('ala');
  const fourth = await forgot('ala');
  assert.equal(outbox.length, 1);
  assert.deepEqual([fourth.status, fourth.json], [ok.status, ok.json]);
});

test('podobny czas odpowiedzi: konto z adresem i nieistniejące wyrównane do stałej wartości', { skip }, async () => {
  await addVerified('gosia', 'gosia@example.test');
  acct.setResponseFloor(300);
  try {
    const time = async (login) => { const t = Date.now(); await forgot(login); return Date.now() - t; };
    const a = await time('gosia');
    const b = await time('nikogo-takiego');
    assert.ok(a >= 290 && b >= 290, `${a} ${b}`);
    assert.ok(Math.abs(a - b) < 150, `${a} ${b}`);
  } finally {
    acct.setResponseFloor(0);
  }
});

test('reset: nowe hasło jeden raz, wylogowanie wszędzie, pusta lista sesji, stare hasło nie działa', { skip }, async () => {
  await addVerified('ela', 'ela@example.test');
  const s1 = await login('ela');
  const s2 = await login('ela');
  await forgot('ela');
  const token = tokenFrom(outbox.at(-1));
  jar.clear();
  assert.equal((await req('auth/reset', 'POST', { token, password: 'krotkie' })).status, 400);
  const r = await req('auth/reset', 'POST', { token, password: 'nowehaslo1' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await req('auth/reset', 'POST', { token, password: 'innehaslo1' })).status, 400, 'token jednorazowy');
  for (const s of [s1, s2]) { use(s); assert.equal(await auth.getUser(), null); }
  assert.equal((await q`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${ids.ela} AND revoked_at IS NULL`)[0].n, 0);
  jar.clear();
  freshIp();
  assert.equal((await req('auth/login', 'POST', { username: 'ela', password: 'haslo1234' })).status, 401);
  const fresh = await login('ela', 'nowehaslo1');
  use(fresh);
  const list = await req('account/sessions', 'GET');
  assert.equal(list.json.sessions.length, 1);
  assert.equal((await q`SELECT must_change_password FROM users WHERE id = ${ids.ela}`)[0].must_change_password, false);
});

test('wygasły token (po 30 min) nie działa; zmiana hasła i reset przez admina unieważniają link', { skip }, async () => {
  await addVerified('franek', 'franek@example.test');
  await forgot('franek');
  let token = tokenFrom(outbox.at(-1));
  await q`UPDATE email_tokens SET expires_at = now() - interval '1 second' WHERE user_id = ${ids.franek}`;
  jar.clear();
  assert.equal((await req('auth/reset', 'POST', { token, password: 'nowehaslo1' })).status, 400);
  // zmiana hasła w profilu
  await forgot('franek');
  token = tokenFrom(outbox.at(-1));
  use(await login('franek'));
  assert.equal((await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'haslo12345' })).status, 200);
  jar.clear();
  assert.equal((await req('auth/reset', 'POST', { token, password: 'nowehaslo1' })).status, 400);
  // reset hasła przez admina (inna ścieżka zapisu hasła, ten sam wyzwalacz)
  await q`DELETE FROM rate_limits WHERE key LIKE 'mail-reset%' OR key LIKE 'forgot-id%'`;
  await forgot('franek');
  token = tokenFrom(outbox.at(-1));
  await q`UPDATE users SET password_hash = 'x' WHERE id = ${ids.franek}`;
  assert.equal((await q`SELECT count(*)::int AS n FROM email_tokens WHERE user_id = ${ids.franek} AND purpose = 'reset'`)[0].n, 0);
  jar.clear();
  assert.equal((await req('auth/reset', 'POST', { token, password: 'nowehaslo1' })).status, 400);
});

test('limity: na IP i na wpisany tekst zwracają 429 niezależnie od istnienia konta', { skip }, async () => {
  jar.clear();
  client.ip = '10.200.0.1';
  const codes = [];
  for (let i = 0; i < 11; i++) codes.push((await req('auth/forgot', 'POST', { login: `ktos${i}` })).status);
  assert.deepEqual(codes.slice(0, 10), Array(10).fill(200));
  assert.equal(codes[10], 429);
  const id = [];
  for (let i = 0; i < 6; i++) id.push((await forgot('nieznany-login')).status);
  assert.deepEqual(id, [200, 200, 200, 200, 200, 429]);
  // weryfikacja i reset: limit na IP
  jar.clear();
  client.ip = '10.200.0.2';
  const v = [];
  for (let i = 0; i < 21; i++) v.push((await req('account/email/verify', 'POST', { token: 'x' })).status);
  assert.equal(v[19], 400);
  assert.equal(v[20], 429);
  // dodawanie adresu: 5 na godzinę na konto
  use(await login('henio'));
  const p = [];
  for (let i = 0; i < 6; i++) p.push((await req('account/email', 'PUT', { email: `h${i}@example.test`, consent: true, password: 'haslo1234' })).status);
  assert.deepEqual(p, [200, 200, 200, 200, 200, 429]);
});

test('Host header injection: bez APP_URL link tylko do hosta z listy dozwolonych, obcy host = brak wysyłki', { skip }, async () => {
  delete process.env.APP_URL;
  try {
    outbox.length = 0;
    client.host = 'evil.example';
    process.env.APP_HOSTS = 'zielnik.example,notatnik.example';
    await q`DELETE FROM rate_limits WHERE key LIKE 'mail-reset%' OR key LIKE 'forgot-id%'`;
    assert.equal((await forgot('gosia')).status, 200);
    assert.equal(outbox.length, 0, 'obcy Host: brak maila');
    client.host = 'notatnik.example';
    await forgot('gosia');
    assert.equal(outbox.length, 1);
    assert.ok(outbox[0].text.includes('https://notatnik.example/nowe-haslo#t='));
    assert.equal(outbox[0].text.includes('evil'), false);
    // błędny APP_URL (nie https) też blokuje wysyłkę zamiast brać Host
    process.env.APP_URL = 'http://evil.example';
    outbox.length = 0;
    await q`DELETE FROM rate_limits WHERE key LIKE 'mail-reset%' OR key LIKE 'forgot-id%'`;
    await forgot('gosia');
    assert.equal(outbox.length, 0);
  } finally {
    process.env.APP_URL = APP;
    delete process.env.APP_HOSTS;
    client.host = null;
  }
});

test('treść neutralna: bez słowa „konopie”, w trybie dyskretnym nazwa „Notatnik”', { skip }, async () => {
  outbox.length = 0;
  await q`DELETE FROM rate_limits WHERE key LIKE 'mail-reset%' OR key LIKE 'forgot-id%'`;
  await forgot('gosia');
  jar.clear();
  jar.set('zielnik_discreet', '1');
  freshIp();
  await req('auth/forgot', 'POST', { login: 'gosia' });
  assert.equal(outbox.length, 2);
  assert.match(outbox[0].subject, /^Zielnik:/);
  assert.match(outbox[1].subject, /^Notatnik:/);
  assert.equal(outbox[1].text.includes('Zielnik'), false);
  for (const m of outbox) assert.equal(/konop|marihuan|thc|lek/i.test(m.subject + m.text + m.html), false, m.text);
});

test('prywatność adresu: eksport właściciela tak, inni nie; kopia bez tokenów; usunięcie konta kasuje adres i tokeny', { skip }, async () => {
  use(await login('gosia'));
  const ex = await req('account/export', 'GET');
  assert.equal(ex.json.profile.email, 'gosia@example.test');
  assert.ok(ex.json.profile.email_verified_at);
  use(await login('bob'));
  const mod = await import('../../app/api/users/search/route.js');
  const res = await mod.GET(new Request('http://localhost/api/users/search?q=gosia'));
  const text = await res.text();
  assert.equal(text.includes('@example.test'), false);
  const backup = await import('../../lib/backup.js');
  const b = await backup.buildBackup();
  assert.equal('email_tokens' in b, false);
  assert.equal(b.users.find((u) => u.username === 'gosia').email, 'gosia@example.test');
  await forgot('gosia');
  use(await login('gosia'));
  assert.equal((await req('account', 'DELETE', { password: 'haslo1234' })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM email_tokens WHERE user_id = ${ids.gosia}`)[0].n, 0);
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE email = 'gosia@example.test'`)[0].n, 0);
});
