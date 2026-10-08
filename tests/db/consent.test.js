// Beta B: zgoda z wersją dokumentów (users.consent_version), osobna zgoda na dane o zdrowiu, ponowna akceptacja, eksport.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, getUser, LEGAL_VERSION, legalMod;
const savedEnv = {};
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
  // dokumenty kompletne (kontakt administratora ustawiony), jak na produkcji po uzupełnieniu zmiennych
  for (const k of ['LEGAL_ADMIN_NAME', 'LEGAL_CONTACT_EMAIL']) savedEnv[k] = process.env[k];
  process.env.LEGAL_ADMIN_NAME = 'Jan Testowy';
  process.env.LEGAL_CONTACT_EMAIL = 'kontakt@example.test';
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession, getUser } = await import('../../lib/auth.js'));
  legalMod = await import('../../lib/legal.js');
  LEGAL_VERSION = legalMod.legalVersion(); // wersja efektywna: rewizja + skrót kontaktu
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('CONSENT', 50)`;
});

after(async () => {
  for (const [k, v] of Object.entries(savedEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  if (pool) await pool.end();
});

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

// --- dowód zgody (consent_log) ---

const log = (id) => q`SELECT version, terms, health, at FROM consent_log WHERE user_id = ${id} ORDER BY at, id`;

test('consent_log: rejestracja zapisuje wpis, ponowna akceptacja dopisuje drugi i nie traci pierwszego', { skip }, async () => {
  assert.equal((await reg('dowod')).status, 200);
  const [u] = await q`SELECT id FROM users WHERE username = 'dowod'`;
  const first = await log(u.id);
  assert.equal(first.length, 1);
  assert.deepEqual([first[0].version, first[0].terms, first[0].health], [LEGAL_VERSION, true, true]);
  // zmiana dokumentów: konto ze starą wersją akceptuje ponownie
  await q`UPDATE users SET consent_version = '2026-09-stara' WHERE id = ${u.id}`;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await call(u.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: LEGAL_VERSION })).status, 200);
  const all = await log(u.id);
  assert.equal(all.length, 2, 'historia, nie nadpisanie');
  assert.equal(all[0].at.getTime(), first[0].at.getTime(), 'pierwsza zgoda zachowana bez zmian');
  assert.ok(all[1].at > all[0].at);
  // odrzucone próby niczego nie dopisują
  assert.equal((await call(u.id, 'account/consent', 'POST', { consent: true, healthConsent: false, version: LEGAL_VERSION })).status, 400);
  assert.equal((await call(u.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: 'stara' })).status, 409);
  assert.equal((await log(u.id)).length, 2);
  // eksport zawiera historię, a tylko własną
  const ex = await call(u.id, 'account/export', 'GET');
  assert.equal(ex.json.consentLog.length, 2);
  assert.deepEqual(Object.keys(ex.json.consentLog[0]).sort(), ['at', 'health', 'terms', 'version']);
  // spójność z profilem: najnowszy wpis = bieżący stan
  assert.equal(ex.json.profile.consentVersion, ex.json.consentLog[1].version);
  assert.equal(new Date(ex.json.profile.consentAt).getTime(), new Date(ex.json.consentLog[1].at).getTime());
  assert.equal(ex.json.profile.consent_at, ex.json.profile.consentAt);
  // kopia zapasowa zawiera tabelę automatycznie
  const { buildBackup } = await import('../../lib/backup.js');
  assert.ok((await buildBackup()).consent_log.some((r) => r.user_id === u.id));
});

test('migracja consent_log: konta sprzed tabeli dostają jeden wpis stanu, ponowne ensureDb nic nie dubluje', { skip }, async () => {
  const [a] = await q`INSERT INTO users (username, password_hash, consent_at, consent_version) VALUES ('wersjonowany', 'x', now() - interval '3 days', '2026-10-beta1') RETURNING id`;
  const [b] = await q`INSERT INTO users (username, password_hash, consent_at) VALUES ('przedwersja', 'x', now() - interval '9 days') RETURNING id`;
  const [c] = await q`INSERT INTO users (username, password_hash) VALUES ('bezzgody', 'x') RETURNING id`;
  // ensureDb jest pamiętane w procesie i pomijane przy zgodnej sumie schematu: pełną migrację wymuszamy w osobnym procesie
  // (jak zimny start funkcji po wdrożeniu), po skasowaniu sumy schematu
  const { execFileSync } = await import('node:child_process');
  const ROOT = new URL('../../', import.meta.url);
  for (let n = 0; n < 2; n++) {
    await q`DELETE FROM schema_meta WHERE key = 'schema'`;
    execFileSync(process.execPath, ['--experimental-default-type=module', '--import', './tests/db/register.mjs', '-e',
      "import('./lib/db.js').then((m) => m.ensureDb()).then(() => process.exit(0), (e) => { console.error(e); process.exit(1); })"],
    { cwd: ROOT, env: process.env, stdio: 'pipe' });
  }
  const la = await log(a.id), lb = await log(b.id);
  assert.equal(la.length, 1);
  assert.deepEqual([la[0].version, la[0].health], ['2026-10-beta1', true]);
  assert.equal(lb.length, 1);
  assert.deepEqual([lb[0].version, lb[0].terms, lb[0].health], [null, true, false], 'zgody zdrowotnej sprzed wersjonowania nie zmyślamy');
  assert.equal((await log(c.id)).length, 0);
  // usunięcie konta kasuje historię
  await q`DELETE FROM users WHERE id = ${a.id}`;
  assert.equal((await log(a.id)).length, 0);
});

// --- kontakt administratora w wersji dokumentów ---

const withEnv = async (env, fn) => {
  const old = {};
  for (const k of Object.keys(env)) { old[k] = process.env[k]; if (env[k] === null) delete process.env[k]; else process.env[k] = env[k]; }
  try { return await fn(); } finally { for (const [k, v] of Object.entries(old)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; } }
};

test('legalVersion: zależy od treści kontaktu (nazwa, e-mail), nie od wielkości liter e-maila ani od białych znaków', { skip }, async () => {
  const { legalVersion, legalContactReady, LEGAL_VERSION: rev } = legalMod;
  const e = (name, email) => ({ LEGAL_ADMIN_NAME: name, LEGAL_CONTACT_EMAIL: email });
  const v1 = legalVersion(e('Jan Testowy', 'kontakt@example.test'));
  assert.match(v1, new RegExp(`^${rev}\\.[0-9a-f]{8}$`));
  assert.equal(v1, LEGAL_VERSION);
  assert.equal(legalVersion(e('  Jan Testowy ', 'KONTAKT@example.test')), v1);
  assert.notEqual(legalVersion(e('Jan Inny', 'kontakt@example.test')), v1);
  assert.notEqual(legalVersion(e('Jan Testowy', 'inny@example.test')), v1);
  assert.equal(legalContactReady(e('Jan', 'a@b.pl')), true);
  for (const bad of [e('', 'a@b.pl'), e('Jan', ''), e('  ', 'a@b.pl'), {}]) {
    assert.equal(legalContactReady(bad), false);
    assert.equal(legalVersion(bad), `${rev}.bez-kontaktu`);
  }
  assert.equal(legalMod.consentCurrent(v1, e('Jan Testowy', 'kontakt@example.test')), true);
  assert.equal(legalMod.consentCurrent(v1, e('Jan Inny', 'kontakt@example.test')), false);
});

test('zmiana kontaktu po akceptacji wymaga ponownej akceptacji; stara wersja z ekranu jest odrzucana (409)', { skip }, async () => {
  const [u] = await q`SELECT id FROM users WHERE username = 'dowod'`;
  await q`UPDATE users SET consent_version = ${LEGAL_VERSION} WHERE id = ${u.id}`;
  await withEnv({ LEGAL_CONTACT_EMAIL: 'nowy@example.test' }, async () => {
    const now = legalMod.legalVersion();
    assert.notEqual(now, LEGAL_VERSION);
    await createSession(u.id);
    assert.notEqual((await getUser()).consent_version, now, 'konto widzi ekran zgody (Header porównuje z legalVersion)');
    const stale = await call(u.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: LEGAL_VERSION });
    assert.equal(stale.status, 409);
    const ok = await call(u.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: now });
    assert.equal(ok.status, 200);
    assert.equal((await q`SELECT consent_version FROM users WHERE id = ${u.id}`)[0].consent_version, now);
    assert.equal((await log(u.id)).at(-1).version, now);
  });
});

test('brak kontaktu administratora: zgody nie da się zapisać (409), rejestracja działa i oznacza wersję „bez-kontaktu”', { skip }, async () => {
  const [u] = await q`SELECT id FROM users WHERE username = 'dowod'`;
  await withEnv({ LEGAL_ADMIN_NAME: null, LEGAL_CONTACT_EMAIL: null }, async () => {
    const v = legalMod.legalVersion();
    assert.match(v, /\.bez-kontaktu$/);
    const r = await call(u.id, 'account/consent', 'POST', { consent: true, healthConsent: true, version: v });
    assert.equal(r.status, 409);
    assert.match(r.json.error, /przygotowaniu/);
    assert.equal((await reg('bezkontaktu')).status, 200);
    assert.match((await q`SELECT consent_version FROM users WHERE username = 'bezkontaktu'`)[0].consent_version, /\.bez-kontaktu$/);
  });
  // po ustawieniu kontaktu konto z wersją „bez-kontaktu” jest nieaktualne: zaakceptuje kompletny dokument
  const [b] = await q`SELECT consent_version FROM users WHERE username = 'bezkontaktu'`;
  assert.notEqual(b.consent_version, LEGAL_VERSION);
});

// --- panel „Gotowość”: kontakt i widoczność ---

test('Gotowość: brak kontaktu to pozycja blokująca (bez wartości), z kontaktem ok', { skip }, async () => {
  const { configChecks } = await import('../../lib/readiness.js');
  const pick = () => configChecks().find((c) => c.id === 'legal-contact');
  assert.equal(pick().state, 'ok');
  assert.equal(pick().optional, false);
  assert.ok(!JSON.stringify(pick()).includes('Jan Testowy'));
  await withEnv({ LEGAL_CONTACT_EMAIL: null }, async () => {
    assert.equal(pick().state, 'missing');
    assert.match(pick().hint, /e-mail/);
    assert.ok(!JSON.stringify(pick()).includes('Jan Testowy'));
  });
  await withEnv({ LEGAL_ADMIN_NAME: null, LEGAL_CONTACT_EMAIL: null }, async () => assert.match(pick().hint, /nazwa i e-mail/));
});

test('widoczność: domyślnie „me” dla nowych wpisów (kolumna i INSERT bez pola), Gotowość liczy wiersze „all”', { skip }, async () => {
  const cols = await q`SELECT table_name, column_default FROM information_schema.columns WHERE column_name = 'visibility' AND table_name IN ('user_strain', 'strain_tests')`;
  assert.equal(cols.length, 2);
  for (const c of cols) assert.match(c.column_default, /'me'/, c.table_name);
  const [u] = await q`SELECT id FROM users WHERE username = 'dowod'`;
  const [s] = await q`INSERT INTO strains (producer, name, type) VALUES ('P', 'Widoczność', 'haze') RETURNING id`;
  const { readinessReport } = await import('../../lib/readiness.js');
  const before = (await readinessReport()).visibilityAll;
  await q`INSERT INTO user_strain (strain_id, user_id, rating) VALUES (${s.id}, ${u.id}, 7)`;
  await q`INSERT INTO strain_tests (strain_id, user_id, note) VALUES (${s.id}, ${u.id}, 'n')`;
  assert.equal((await q`SELECT visibility FROM user_strain WHERE strain_id = ${s.id}`)[0].visibility, 'me');
  assert.equal((await q`SELECT visibility FROM strain_tests WHERE strain_id = ${s.id}`)[0].visibility, 'me');
  assert.deepEqual((await readinessReport()).visibilityAll, before, 'nowe wpisy są prywatne: licznik bez zmian');
  // ensureDb nie zmienia danych użytkowników (stare wpisy „all” zostają)
  await q`UPDATE user_strain SET visibility = 'all' WHERE strain_id = ${s.id}`;
  await q`UPDATE strain_tests SET visibility = 'all' WHERE strain_id = ${s.id}`;
  const { ensureDb } = await import('../../lib/db.js');
  await ensureDb();
  const after_ = (await readinessReport()).visibilityAll;
  assert.equal(after_.userStrain, before.userStrain + 1);
  assert.equal(after_.strainTests, before.strainTests + 1);
  assert.deepEqual(Object.keys(after_).sort(), ['strainTests', 'userStrain'], 'tylko liczby');
});
