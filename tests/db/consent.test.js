// Beta B: zgoda z wersją dokumentów (users.consent_version), osobna zgoda na dane o zdrowiu, ponowna akceptacja, eksport.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, getUser, LEGAL_VERSION;
const ids = {};

async function call(uid, route, method, body) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve({}) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}
const reg = (username, extra = {}) => call(null, 'auth/register', 'POST', { username, password: 'haslo1234', invite: 'consent', adult: true, consent: true, healthConsent: true, ...extra });
const uses = async () => (await q`SELECT uses FROM invites WHERE code = 'CONSENT'`)[0].uses;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession, getUser } = await import('../../lib/auth.js'));
  ({ LEGAL_VERSION } = await import('../../lib/legal.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('CONSENT', 50)`;
});

after(async () => { if (pool) await pool.end(); });

test('migracja: kolumna consent_version istnieje, ensureDb idempotentne', { skip }, async () => {
  const { ensureDb } = await import('../../lib/db.js');
  await ensureDb();
  const c = await q`SELECT data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'consent_version'`;
  assert.equal(c.length, 1);
  assert.equal(c[0].data_type, 'text');
  // idempotentnie: ponowne ALTER nie psuje i nie zeruje danych
  await q`ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_version TEXT`;
});

test('rejestracja wymaga obu zgód i pełnoletności (400), nic się nie zapisuje ani nie zużywa kodu', { skip }, async () => {
  const before = await uses();
  const cases = [
    ['brak regulaminu', { consent: false }],
    ['brak zgody zdrowotnej', { healthConsent: false }],
    ['zgoda zdrowotna nieprzesłana', { healthConsent: undefined }],
    ['stary klient: tylko consent', { healthConsent: undefined, consent: true }],
    ['tekst zamiast true', { consent: 'true' }],
    ['brak pełnoletności', { adult: false }],
  ];
  for (const [name, extra] of cases) {
    const r = await reg(`odmowa${cases.findIndex((c) => c[0] === name)}`, extra);
    assert.equal(r.status, 400, `${name}: ${JSON.stringify(r.json)}`);
  }
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE username LIKE 'odmowa%'`)[0].n, 0);
  assert.equal(await uses(), before);
  const noHealth = await reg('odmowa-x', { healthConsent: false });
  assert.match(noHealth.json.error, /zdrowiu/);
});

test('rejestracja z obiema zgodami zapisuje wersję i datę zgody', { skip }, async () => {
  const r = await reg('ola');
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [u] = await q`SELECT id, consent_at, consent_version FROM users WHERE username = 'ola'`;
  ids.ola = u.id;
  assert.equal(u.consent_version, LEGAL_VERSION);
  assert.ok(u.consent_at);
  assert.equal((await getUser()).consent_version, LEGAL_VERSION);
});

test('konto sprzed wersjonowania (NULL): sesja działa, getUser zgłasza brak aktualnej wersji, eksport pokazuje null', { skip }, async () => {
  await reg('stary');
  const [u] = await q`UPDATE users SET consent_version = NULL WHERE username = 'stary' RETURNING id`;
  ids.stary = u.id;
  await createSession(u.id);
  const me = await getUser();
  assert.ok(me, 'stara sesja nie jest unieważniana');
  assert.equal(me.consent_version, null);
  assert.notEqual(me.consent_version, LEGAL_VERSION);
  const ex = await call(u.id, 'account/export', 'GET');
  assert.equal(ex.status, 200, 'eksport (ścieżka ucieczki z ekranu zgody) działa bez akceptacji');
  assert.equal(ex.json.profile.consentVersion, null);
  assert.ok(ex.json.profile.consentAt);
});

test('POST account/consent: wymaga sesji, obu zgód i bieżącej wersji', { skip }, async () => {
  const body = { consent: true, healthConsent: true, version: LEGAL_VERSION };
  assert.equal((await call(null, 'account/consent', 'POST', body)).status, 401);
  assert.equal((await call(ids.stary, 'account/consent', 'POST', { ...body, consent: false })).status, 400);
  assert.equal((await call(ids.stary, 'account/consent', 'POST', { ...body, healthConsent: false })).status, 400);
  assert.equal((await call(ids.stary, 'account/consent', 'POST', { ...body, healthConsent: 1 })).status, 400);
  const old = await call(ids.stary, 'account/consent', 'POST', { ...body, version: '1999-stara' });
  assert.equal(old.status, 409);
  assert.equal((await call(ids.stary, 'account/consent', 'POST', { consent: true, healthConsent: true })).status, 409);
  const [still] = await q`SELECT consent_version FROM users WHERE id = ${ids.stary}`;
  assert.equal(still.consent_version, null, 'odrzucone próby niczego nie zapisują');
});

test('ponowna akceptacja zapisuje bieżącą wersję i nową datę, nie dotyka innych kont', { skip }, async () => {
  const [before] = await q`SELECT consent_at FROM users WHERE id = ${ids.stary}`;
  const [olaBefore] = await q`SELECT consent_at, consent_version FROM users WHERE id = ${ids.ola}`;
  await new Promise((r) => setTimeout(r, 20));
  const r = await call(ids.stary, 'account/consent', 'POST', { consent: true, healthConsent: true, version: LEGAL_VERSION, evil: 'x' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const [u] = await q`SELECT consent_at, consent_version FROM users WHERE id = ${ids.stary}`;
  assert.equal(u.consent_version, LEGAL_VERSION);
  assert.ok(u.consent_at > before.consent_at);
  assert.deepEqual((await q`SELECT consent_at, consent_version FROM users WHERE id = ${ids.ola}`)[0], olaBefore);
  await createSession(ids.stary);
  assert.equal((await getUser()).consent_version, LEGAL_VERSION);
});

test('zmiana wersji dokumentów: konto z wersją wcześniejszą akceptuje ponownie', { skip }, async () => {
  await q`UPDATE users SET consent_version = '2026-09-stara' WHERE id = ${ids.ola}`;
  await createSession(ids.ola);
  assert.notEqual((await getUser()).consent_version, LEGAL_VERSION);
  assert.equal((await call(ids.ola, 'account/consent', 'POST', { consent: true, healthConsent: true, version: LEGAL_VERSION })).status, 200);
  assert.equal((await q`SELECT consent_version FROM users WHERE id = ${ids.ola}`)[0].consent_version, LEGAL_VERSION);
});

test('admin (konto z bootstrapu, NULL) też akceptuje; eksport zawiera consentAt i consentVersion', { skip }, async () => {
  const [b] = await q`UPDATE users SET must_change_password = FALSE WHERE lower(username) = 'bocian' RETURNING id, consent_version`;
  assert.equal(b.consent_version, null, 'konto utworzone przez bootstrap nie ma wersji zgody');
  assert.equal((await call(b.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: LEGAL_VERSION })).status, 200);
  const ex = await call(b.id, 'account/export', 'GET');
  assert.equal(ex.json.profile.consentVersion, LEGAL_VERSION);
  assert.ok(ex.json.profile.consentAt);
  const ola = await call(ids.ola, 'account/export', 'GET');
  assert.equal(ola.json.profile.consentVersion, LEGAL_VERSION);
});

test('konto z bootstrapu admina z wymuszoną zmianą hasła nie może zaakceptować przed zmianą hasła', { skip }, async () => {
  await q`UPDATE users SET must_change_password = TRUE, consent_version = NULL WHERE lower(username) = 'bocian'`;
  const [b] = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  assert.equal((await call(b.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: LEGAL_VERSION })).status, 403);
});
