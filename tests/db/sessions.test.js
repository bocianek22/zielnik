// POM-27: tabela sesji, lista urządzeń, wylogowanie pojedynczej sesji i pozostałych, tokeny sprzed `sid`, sprzątanie.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const COOKIE = 'zielnik_session';
const UA_CHROME_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36';
const UA_APP = `${UA_CHROME_ANDROID} ZielnikApp/0.37.0 ZielnikPush/fcm`;
const UA_SAFARI_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
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
// Logowanie w nowej "przeglądarce"; zwraca odpowiedź i token
async function login(username, { ip = '10.0.0.1', ua = null, country = null } = {}) {
  jar.clear();
  Object.assign(client, { ip, ua, country });
  const r = await req('auth/login', 'POST', { username, password: 'haslo1234' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return jar.get(COOKIE);
}
async function who(token) {
  jar.clear();
  if (token) jar.set(COOKIE, token);
  return auth.getUser();
}
const use = (token) => { jar.clear(); jar.set(COOKIE, token); };
const sidOf = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sid;
// Token w starym formacie (sprzed `sid`), podpisany jak dawniej
async function legacyToken(uid, sv = 0, ago = 0) {
  const { SignJWT } = await import('jose');
  const key = new TextEncoder().encode(process.env.AUTH_SECRET);
  return new SignJWT({ uid, sv }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt(Math.floor(Date.now() / 1000) - ago).setExpirationTime('30d').sign(key);
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
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 20)`;
  for (const n of ['ala', 'bob', 'cela', 'darek', 'ela', 'franek']) {
    jar.clear();
    client.ip = `10.1.0.${Object.keys(ids).length + 1}`;
    const r = await req('auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    ids[n] = (await q`SELECT id FROM users WHERE username = ${n}`)[0].id;
  }
});

after(async () => { if (client) Object.assign(client, { ip: '127.0.0.1', ua: null, country: null }); if (pool) await pool.end(); });

test('logowanie zapisuje sesję z opisem urządzenia, bez IP i pełnego User-Agent; lista oznacza to urządzenie', { skip }, async () => {
  const phone = await login('ala', { ua: UA_APP, country: 'pl' });
  const mac = await login('ala', { ip: '10.0.0.2', ua: UA_SAFARI_MAC, country: 'XX1' });
  const [s] = await q`SELECT * FROM sessions WHERE id = ${sidOf(phone)}`;
  assert.equal(s.user_id, ids.ala);
  assert.equal(s.device, 'Aplikacja Zielnik, Android');
  assert.equal(s.native, true);
  assert.equal(s.country, 'PL');
  const all = JSON.stringify(await q`SELECT * FROM sessions WHERE user_id = ${ids.ala}`);
  assert.ok(!all.includes('10.0.0') && !all.includes('Mozilla') && !all.includes('Pixel'), 'brak IP i surowego UA');
  use(mac);
  const r = await req('account/sessions', 'GET');
  assert.equal(r.status, 200);
  const mine = r.json.sessions.filter((x) => x.current);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].id, sidOf(mac));
  assert.equal(mine[0].device, 'Safari, macOS');
  assert.equal(mine[0].country, null, 'nieprawidłowy kraj pominięty');
  assert.ok(r.json.sessions.some((x) => x.id === sidOf(phone) && !x.current));
  // bez sesji: 401
  jar.clear();
  assert.equal((await req('account/sessions', 'GET')).status, 401);
});

test('wylogowanie pojedynczej sesji z listy; cudza sesja = 404', { skip }, async () => {
  const a1 = await login('bob');
  const a2 = await login('bob', { ip: '10.0.0.3' });
  const other = await login('cela');
  use(a1);
  // cudza, nieistniejąca i źle zbudowana: 404, nic się nie zmienia
  for (const id of [sidOf(other), 'x'.repeat(24), '../..', '']) {
    const r = await req('account/sessions/[id]', 'DELETE', null, { id });
    assert.equal(r.status, 404, `${id}: ${JSON.stringify(r.json)}`);
  }
  assert.equal((await who(other))?.id, ids.cela, 'cudza sesja działa dalej');
  use(a1);
  const r = await req('account/sessions/[id]', 'DELETE', null, { id: sidOf(a2) });
  assert.equal(r.status, 200);
  assert.equal(r.json.current, false);
  assert.equal(await who(a2), null, 'wylogowana sesja odrzucona');
  assert.equal((await who(a1))?.id, ids.bob, 'bieżąca działa');
  use(a1);
  assert.equal((await req('account/sessions/[id]', 'DELETE', null, { id: sidOf(a2) })).status, 404, 'drugi raz: 404');
  // wylogowanie bieżącej z listy usuwa też ciasteczko
  const r2 = await req('account/sessions/[id]', 'DELETE', null, { id: sidOf(a1) });
  assert.equal(r2.status, 200);
  assert.equal(r2.json.current, true);
  assert.equal(jar.get(COOKIE), undefined);
  assert.equal(await who(a1), null);
});

test('zwykłe wylogowanie unieważnia skopiowany token tego urządzenia, nie inne', { skip }, async () => {
  const a = await login('darek');
  const b = await login('darek', { ip: '10.0.0.4' });
  use(a);
  assert.equal((await req('auth/logout', 'POST')).status, 200);
  assert.equal(await who(a), null, 'skopiowany token po wylogowaniu nie działa');
  assert.equal((await who(b))?.id, ids.darek);
});

test('wyloguj inne urządzenia i zmiana hasła: bieżąca sesja zostaje (ten sam sid), pozostałe odrzucone', { skip }, async () => {
  const a = await login('ela');
  const b = await login('ela', { ip: '10.0.0.5' });
  const old = await legacyToken(ids.ela); // token sprzed POM-27, który jeszcze nie trafił na serwer
  use(a);
  const r = await req('account/sessions', 'DELETE');
  assert.equal(r.status, 200);
  const fresh = jar.get(COOKIE);
  assert.notEqual(fresh, a);
  assert.equal(sidOf(fresh), sidOf(a), 'to samo urządzenie na liście');
  assert.equal(await who(b), null);
  assert.equal(await who(old), null, 'stary token bez wiersza też odrzucony (nowa wersja sesji)');
  assert.equal(await who(a), null, 'poprzedni token tego urządzenia nieważny');
  assert.equal((await who(fresh))?.id, ids.ela);
  use(fresh);
  assert.deepEqual((await req('account/sessions', 'GET')).json.sessions.map((x) => x.id), [sidOf(a)]);
  // zmiana hasła: to samo
  const c = await login('ela', { ip: '10.0.0.6' });
  use(fresh);
  const p = await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'nowehaslo1' });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  const after = jar.get(COOKIE);
  assert.equal(sidOf(after), sidOf(a));
  assert.equal(await who(c), null);
  assert.equal(await who(fresh), null);
  assert.equal((await who(after))?.id, ids.ela);
  const [{ n }] = await q`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${ids.ela} AND revoked_at IS NULL`;
  assert.equal(n, 1);
});

test('reset hasła przez admina i „wyloguj wszędzie” unieważniają wiersze sesji', { skip }, async () => {
  const a = await login('franek');
  use(a);
  assert.equal((await req('auth/logout', 'POST', { all: true })).status, 200);
  assert.equal(await who(a), null);
  const [{ n }] = await q`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${ids.franek} AND revoked_at IS NULL`;
  assert.equal(n, 0);
  const b = await login('franek');
  jar.clear();
  const [{ id: boc }] = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${boc}`;
  await auth.createSession(boc);
  assert.equal((await req('admin/users/[id]', 'PATCH', null, { id: String(ids.franek) })).status, 200);
  assert.equal(await who(b), null);
  const [{ m }] = await q`SELECT count(*)::int AS m FROM sessions WHERE user_id = ${ids.franek} AND revoked_at IS NULL`;
  assert.equal(m, 0);
});

test('stary token bez sid: działa, trafia na listę, można go wylogować pojedynczo (i zostaje odrzucony)', { skip }, async () => {
  Object.assign(client, { ua: UA_CHROME_ANDROID, country: 'DE' });
  const old = await legacyToken(ids.cela);
  assert.equal((await who(old))?.id, ids.cela, 'wdrożenie nikogo nie wylogowuje');
  assert.equal((await who(old))?.id, ids.cela, 'drugie użycie bez duplikatu');
  const rows = await q`SELECT id, device, country, expires_at FROM sessions WHERE user_id = ${ids.cela} AND length(id) = 32`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].device, 'Chrome, Android');
  assert.equal(rows[0].country, 'DE');
  assert.ok(rows[0].expires_at > new Date(Date.now() + 29 * 864e5), 'wygasa razem z tokenem');
  const cur = await login('cela', { ip: '10.0.0.7' });
  use(cur);
  const list = (await req('account/sessions', 'GET')).json.sessions;
  assert.ok(list.some((x) => x.id === rows[0].id && !x.current));
  assert.equal((await req('account/sessions/[id]', 'DELETE', null, { id: rows[0].id })).status, 200);
  assert.equal(await who(old), null, 'unieważniony stary token nie wraca przy kolejnym żądaniu');
  assert.equal(await who(old), null);
  // stary token z inną wersją sesji i token z `sid` bez wiersza: odrzucone, bez zapisu
  assert.equal(await who(await legacyToken(ids.cela, 7)), null);
  const { SignJWT } = await import('jose');
  const key = new TextEncoder().encode(process.env.AUTH_SECRET);
  const ghost = await new SignJWT({ uid: ids.cela, sv: 0, sid: 'y'.repeat(24) }).setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt().setExpirationTime('1d').sign(key);
  assert.equal(await who(ghost), null, 'sesja z sid bez wiersza (np. po odtworzeniu kopii) odrzucona');
  assert.equal((await q`SELECT count(*)::int AS n FROM sessions WHERE id = ${'y'.repeat(24)}`)[0].n, 0);
  // wylogowanie starym tokenem zostawia unieważniony wiersz
  const old2 = await legacyToken(ids.cela, 0, 3600);
  const old3 = await legacyToken(ids.cela, 0, 7200);
  assert.notEqual(old2, old3);
  use(old3);
  assert.equal((await req('auth/logout', 'POST')).status, 200);
  assert.equal(await who(old3), null);
  assert.equal((await who(old2))?.id, ids.cela, 'inny stary token działa');
  Object.assign(client, { ua: null, country: null });
});

test('stary token jako bieżący: „wyloguj inne” i zmiana hasła zostawiają to urządzenie (sid = identyfikator starej sesji)', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  // hasło po resecie admina w poprzednim teście ustawiamy wprost
  const bcrypt = (await import('bcryptjs')).default;
  await q`UPDATE users SET password_hash = ${await bcrypt.hash('haslo1234', 4)}, must_change_password = FALSE WHERE id = ${ids.franek}`;
  const other = await login('franek', { ip: '10.0.0.12' });
  const [{ sv }] = await q`SELECT session_version AS sv FROM users WHERE id = ${ids.franek}`;
  const old = await legacyToken(ids.franek, sv, 600);
  assert.equal((await who(old))?.id, ids.franek);
  const [{ id: lid }] = await q`SELECT id FROM sessions WHERE user_id = ${ids.franek} AND length(id) = 32`;
  use(old);
  assert.equal((await req('account/sessions', 'DELETE')).status, 200);
  const fresh = jar.get(COOKIE);
  assert.equal(sidOf(fresh), lid);
  assert.equal((await who(fresh))?.id, ids.franek);
  assert.equal(await who(old), null);
  assert.equal(await who(other), null);
  assert.equal((await q`SELECT count(*)::int AS n FROM sessions WHERE id = ${lid} AND revoked_at IS NULL`)[0].n, 1);
  // zmiana hasła z tego samego urządzenia
  use(fresh);
  const p = await req('auth/change-password', 'POST', { current: 'haslo1234', password: 'nowehaslo2' });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  const after = jar.get(COOKIE);
  assert.equal(sidOf(after), lid);
  assert.equal((await who(after))?.id, ids.franek);
  assert.equal(await who(fresh), null);
});

test('ostatnie użycie aktualizowane najwyżej co ~15 min', { skip }, async () => {
  const t = await login('darek', { ip: '10.0.0.8' });
  const sid = sidOf(t);
  await q`UPDATE sessions SET last_used_at = now() - interval '5 minutes' WHERE id = ${sid}`;
  const [before5] = await q`SELECT last_used_at FROM sessions WHERE id = ${sid}`;
  await who(t);
  const [after5] = await q`SELECT last_used_at FROM sessions WHERE id = ${sid}`;
  assert.equal(after5.last_used_at.getTime(), before5.last_used_at.getTime(), '5 min: bez zapisu');
  await q`UPDATE sessions SET last_used_at = now() - interval '20 minutes' WHERE id = ${sid}`;
  await who(t);
  const [after20] = await q`SELECT (now() - last_used_at) < interval '1 minute' AS fresh FROM sessions WHERE id = ${sid}`;
  assert.equal(after20.fresh, true);
});

test('sprzątanie przy logowaniu: wygasłe sesje usunięte, limit aktywnych na konto', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  await q`INSERT INTO sessions (id, user_id, expires_at, revoked_at) VALUES
          (${'e'.repeat(24)}, ${ids.bob}, now() - interval '1 day', NULL),
          (${'f'.repeat(24)}, ${ids.ala}, now() - interval '1 minute', now() - interval '20 days')`;
  for (let i = 0; i < 55; i++) {
    await q`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES
            (${`z${String(i).padStart(23, '0')}`}, ${ids.darek}, now() - make_interval(hours => ${i + 1}), now() + interval '10 days')`;
  }
  const t = await login('darek', { ip: '10.0.0.9' });
  assert.equal((await q`SELECT count(*)::int AS n FROM sessions WHERE expires_at < now()`)[0].n, 0, 'wygasłe usunięte');
  const [{ n }] = await q`SELECT count(*)::int AS n FROM sessions WHERE user_id = ${ids.darek} AND revoked_at IS NULL`;
  assert.equal(n, 50);
  assert.equal((await who(t))?.id, ids.darek, 'najnowsza sesja zostaje');
  const [{ oldest }] = await q`SELECT revoked_at IS NOT NULL AS oldest FROM sessions WHERE id = ${`z${'54'.padStart(23, '0')}`}`;
  assert.equal(oldest, true, 'najstarsza unieważniona');
});

test('limit prób wylogowywania sesji', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  const t = await login('bob', { ip: '10.0.0.10' });
  use(t);
  for (let i = 0; i < 30; i++) assert.equal((await req('account/sessions/[id]', 'DELETE', null, { id: 'q'.repeat(24) })).status, 404);
  assert.equal((await req('account/sessions/[id]', 'DELETE', null, { id: 'q'.repeat(24) })).status, 429);
  assert.equal((await req('account/sessions', 'DELETE')).status, 429);
  await q`DELETE FROM rate_limits`;
});

test('eksport konta: lista sesji bez identyfikatorów; kopia bez tabeli sesji', { skip }, async () => {
  const t = await login('ala', { ip: '10.0.0.11', ua: UA_SAFARI_MAC });
  use(t);
  const mod = await import('../../app/api/account/export/route.js');
  const res = await mod.GET(new Request('http://localhost/api/account/export'));
  assert.equal(res.status, 200);
  const data = JSON.parse(await res.text());
  assert.ok(Array.isArray(data.sessions) && data.sessions.length >= 1);
  assert.ok(data.sessions.some((s) => s.device === 'Safari, macOS'));
  const text = JSON.stringify(data);
  for (const [{ id }] of [await q`SELECT id FROM sessions WHERE user_id = ${ids.ala} LIMIT 1`]) assert.ok(!text.includes(id), 'bez sid');
  assert.ok(!text.includes(sidOf(t)));
  const backup = await import('../../lib/backup.js');
  assert.ok(backup.BACKUP_EXCLUDED.includes('sessions'));
});
