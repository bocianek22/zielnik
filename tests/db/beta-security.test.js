// Przegląd bezpieczeństwa przed betą (PLA-8, skrót): powiadomienie o logowaniu admina, limity prób na trasach dodanych
// od 0.45, trasy admina i publiczne, usunięcie konta (wszystkie tabele z odwołaniem do users) i kompletność eksportu.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const PASSWORD = 'haslo1234';
let q, pool, jar, client, createSession, populate, mail, realFetch, ids;
const hooks = [];

// Wywołanie trasy jako zalogowany użytkownik (uid = null: anonim)
async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
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
  ({ jar, client } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  ({ populate } = await import('./populate.mjs'));
  mail = await import('../../lib/mail.js');
  await db.ensureDb();
  q = db.sql();
  const hash = (await import('bcryptjs')).default.hashSync(PASSWORD, 4);
  const mk = async (n, admin = false) => (await q`INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES (${n}, ${hash}, ${admin}, FALSE) RETURNING id`)[0].id;
  await q`UPDATE users SET password_hash = ${hash}, must_change_password = FALSE WHERE lower(username) = 'bocian'`;
  ids = { admin: (await q`SELECT id FROM users WHERE lower(username) = 'bocian'`)[0].id, ania: await mk('ania'), bartek: await mk('bartek'), celina: await mk('celina') };
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => { hooks.push({ url: String(url), body: JSON.parse(init.body) }); return new Response(null, { status: 204 }); };
});

after(async () => {
  if (realFetch) globalThis.fetch = realFetch;
  delete process.env.ALERT_WEBHOOK_URL;
  if (pool) await pool.end();
});

// --- logowanie admina ---

async function login(username, password = PASSWORD) {
  jar.clear();
  const mod = await import('../../app/api/auth/login/route.js');
  const res = await mod.POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }));
  await mail.flushBackground();
  return res.status;
}

test('logowanie admina: powiadomienie z czasem i skrótem urządzenia, bez IP, nazwy konta i User-Agent', { skip }, async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.test/webhook';
  await q`DELETE FROM rate_limits`;
  client.ip = '198.51.100.77';
  client.ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
  try {
    hooks.length = 0;
    assert.equal(await login('Bocian'), 200);
    assert.equal(hooks.length, 1);
    const text = hooks[0].body.text;
    assert.match(text, /Logowanie admina/);
    assert.match(text, /Urządzenie: Chrome, Windows/);
    assert.match(text, /Czas: \d{4}-\d\d-\d\dT/);
    for (const forbidden of ['198.51.100.77', 'Bocian', 'bocian', 'Mozilla', 'AppleWebKit', PASSWORD]) assert.ok(!JSON.stringify(hooks[0]).includes(forbidden), forbidden);
    // zwykłe konto, błędne hasło i nieistniejące konto: bez powiadomienia
    hooks.length = 0;
    assert.equal(await login('ania'), 200);
    assert.equal(await login('Bocian', 'zle-haslo'), 401);
    assert.equal(await login('nie-ma-takiego'), 401);
    assert.equal(hooks.length, 0);
  } finally { client.ip = '127.0.0.1'; client.ua = null; }
});

test('logowanie admina: bez skonfigurowanych alertów działa i nic nie wysyła; lawina logowań ma limit na godzinę', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  delete process.env.ALERT_WEBHOOK_URL;
  hooks.length = 0;
  assert.equal(await login('Bocian'), 200);
  assert.equal(hooks.length, 0);
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.example.test/webhook';
  await q`DELETE FROM rate_limits`;
  await q`INSERT INTO rate_limits (key, n, reset_at) VALUES ('alert:admin-login', 20, now() + interval '1 hour')`;
  assert.equal(await login('Bocian'), 200, 'logowanie nie zależy od alertu');
  assert.equal(hooks.length, 0);
  delete process.env.ALERT_WEBHOOK_URL;
});

// --- limity prób na trasach dodanych od 0.45 ---

test('limity: zakupy (300/h) i punkty „do omówienia” (60/h) zwracają 429, a pozostałe trasy z listy mają limit w kodzie', { skip }, async () => {
  await q`DELETE FROM rate_limits`;
  const s = (await q`INSERT INTO strains (producer, name, type) VALUES ('P', 'Limitowana', 'haze') RETURNING id`)[0].id;
  const buy = (uid) => call(uid, 'strains/[id]/purchase', 'POST', { grams: 1 }, { id: String(s) });
  assert.equal((await buy(ids.ania)).status, 200);
  await q`INSERT INTO rate_limits (key, n, reset_at) VALUES (${`purchase:${ids.ania}`}, 300, now() + interval '1 hour') ON CONFLICT (key) DO UPDATE SET n = 300, reset_at = EXCLUDED.reset_at`;
  assert.equal((await buy(ids.ania)).status, 429);
  assert.equal((await buy(ids.bartek)).status, 200, 'limit jest na konto');
  const note = (uid) => call(uid, 'doctor-notes', 'POST', { text: 'pytanie' });
  assert.equal((await note(ids.ania)).status, 200);
  await q`INSERT INTO rate_limits (key, n, reset_at) VALUES (${`doctor-note:${ids.ania}`}, 60, now() + interval '1 hour') ON CONFLICT (key) DO UPDATE SET n = 60, reset_at = EXCLUDED.reset_at`;
  const over = await note(ids.ania);
  assert.equal(over.status, 429);
  assert.match(over.json.error, /Zbyt wiele/);
  assert.equal((await note(ids.bartek)).status, 200);
  // propozycje zmian (cudza odmiana): 30/h na konto
  const own = (await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('P', 'Cudza', 'haze', ${ids.celina}) RETURNING id`)[0].id;
  await q`INSERT INTO user_strain (strain_id, user_id, rating) VALUES (${own}, ${ids.celina}, 5), (${own}, ${ids.bartek}, 5)`; // używana przez innych: edycja tylko przez propozycję
  await q`INSERT INTO rate_limits (key, n, reset_at) VALUES (${`proposal:${ids.ania}`}, 30, now() + interval '1 hour') ON CONFLICT (key) DO UPDATE SET n = 30, reset_at = EXCLUDED.reset_at`;
  const prop = await call(ids.ania, 'strains/[id]', 'PATCH', { name: 'Cudza', producer: 'P', type: 'haze', thc: 21 }, { id: String(own) });
  assert.equal(prop.status, 429);
  // trasy z limitem w kodzie: logowanie, rejestracja, odzyskiwanie hasła, zmiana adresu e-mail, usunięcie konta, zgłoszenia, import
  for (const r of ['auth/login', 'auth/register', 'auth/forgot', 'auth/reset', 'account/email', 'account/email/verify', 'account', 'reports', 'import']) {
    assert.match(readFileSync(path.join(process.cwd(), 'app/api', r, 'route.js'), 'utf8'), /hit\(/, `${r}: brak limitu prób`);
  }
  // onboarding i wycofanie propozycji są idempotentne (jeden UPDATE/DELETE własnego wiersza, bez przyrostu danych): bez limitu
  assert.equal((await call(ids.ania, 'onboarding', 'POST')).status, 200);
});

// --- trasy admina i publiczne ---

const routeFiles = (dir) => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? routeFiles(p) : n === 'route.js' ? [p] : [];
});

test('każda trasa /api/admin/** wymaga admina; trasy bez sesji to znana, krótka lista', { skip }, () => {
  const root = path.join(process.cwd(), 'app/api');
  const files = routeFiles(root);
  assert.ok(files.length > 50);
  for (const f of files.filter((x) => x.includes(`${path.sep}admin${path.sep}`))) {
    assert.match(readFileSync(f, 'utf8'), /requireAdmin\(/, `${path.relative(root, f)}: brak requireAdmin()`);
  }
  // wszystko poza tą listą musi sprawdzać sesję (requireUser/requireAdmin/getUser) albo sekret crona
  const PUBLIC = ['account/email/verify', 'auth/forgot', 'auth/login', 'auth/register', 'auth/reset', 'client-error', 'health', 'version'];
  const open = files.filter((f) => !/requireUser|requireAdmin|cronAuthorized|getUser/.test(readFileSync(f, 'utf8')))
    .map((f) => path.dirname(path.relative(root, f)).split(path.sep).join('/')).sort();
  assert.deepEqual(open, PUBLIC);
});

// --- usunięcie konta ---

const fkToUsers = async () => (await q`SELECT k.conrelid::regclass::text AS t, a.attname AS c, k.confdeltype AS d
  FROM pg_constraint k JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = k.conkey[1]
  WHERE k.contype = 'f' AND k.confrelid = 'users'::regclass ORDER BY 1, 2`);

// Kolumny ON DELETE SET NULL: wiersz zostaje, ale bez odwołania do konta. Każdy wyjątek ma uzasadnienie;
// nowa kolumna tego rodzaju (albo zmiana na inny tryb) wywala test, dopóki ktoś nie podejmie decyzji.
const SET_NULL = {
  'strains.created_by': 'wspólny katalog: odmiana używana przez innych zostaje, bez autora',
  'strain_photos.uploaded_by': 'wspólne zdjęcie odmiany zostaje, bez autora (dokumentacja: Zdjęcia)',
  'strain_tests.user_id': 'prywatne testy są kasowane jawnie w trasie (zdjęcia z Blob), SET NULL to tylko siatka bezpieczeństwa',
  'strain_edits.user_id': 'historia zmian wspólnych pól odmiany zostaje anonimowo',
  'strain_proposals.decided_by': 'decyzja admina: pole techniczne',
  'invites.created_by': 'zaproszenie zostaje (kod i limit), bez autora',
  'groups.owner_id': 'grupa zostaje bez właściciela (członkowie kasują się osobno)',
  'group_messages.deleted_by': 'wiadomość usunięta przez moderatora zostaje jako „Wiadomość usunięta”, bez wskazania kto',
  'reports.reporter_id': 'zgłoszenie moderacyjne zostaje, bez zgłaszającego',
};

test('klucze obce do users: każda kolumna to CASCADE albo opisany wyjątek SET NULL', { skip }, async () => {
  const fks = await fkToUsers();
  const unknown = fks.filter((f) => f.d !== 'c' && !SET_NULL[`${f.t}.${f.c}`]).map((f) => `${f.t}.${f.c}`);
  assert.deepEqual(unknown, [], 'nowa kolumna odwołująca się do users bez decyzji: CASCADE albo wyjątek z uzasadnieniem');
  for (const key of Object.keys(SET_NULL)) assert.ok(fks.some((f) => `${f.t}.${f.c}` === key && f.d === 'n'), `${key}: lista wyjątków nieaktualna`);
  // kolumny wyglądające na identyfikator konta, ale bez klucza obcego, zostawiałyby sieroty po usunięciu konta
  const named = await q`SELECT table_name AS t, column_name AS c FROM information_schema.columns WHERE table_schema = 'public'
    AND column_name IN ('user_id', 'created_by', 'owner_id', 'uploaded_by', 'reporter_id', 'target_user_id', 'requester', 'addressee', 'blocker', 'blocked', 'decided_by')`;
  const have = new Set(fks.map((f) => `${f.t}.${f.c}`));
  assert.deepEqual(named.filter((n) => !have.has(`${n.t}.${n.c}`)).map((n) => `${n.t}.${n.c}`), []);
});

async function leftovers(v) {
  const out = {};
  for (const f of await fkToUsers()) {
    out[`${f.t}.${f.c}`] = (await pool.query(`SELECT count(*)::int AS n FROM "${f.t}" WHERE "${f.c}" = $1`, [v])).rows[0].n;
  }
  return out;
}

test('usunięcie konta (samodzielne i przez admina) nie zostawia wierszy z jego id w żadnej tabeli', { skip }, async () => {
  for (const [who, run] of [
    ['samodzielne', (v) => call(v, 'account', 'DELETE', { password: PASSWORD })],
    ['przez admina', (v) => call(ids.admin, 'admin/users/[id]', 'DELETE', null, { id: String(v) })],
  ]) {
    const v = (await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${`ofiara-${who.length}`}, ${(await import('bcryptjs')).default.hashSync(PASSWORD, 4)}, FALSE) RETURNING id`)[0].id;
    const { strain } = await populate(q, { v, o: ids.bartek, a: ids.celina });
    const before = await leftovers(v);
    // test nie może przechodzić „na pusto”: każda kolumna odwołująca się do users ma w tej chwili wiersz ofiary
    for (const [col, n] of Object.entries(before)) assert.ok(n > 0, `${who}: brak danych testowych w ${col}`);
    const r = await run(v);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${v}`)[0].n, 0);
    const after = await leftovers(v);
    for (const [col, n] of Object.entries(after)) assert.equal(n, 0, `${who}: zostały wiersze z id konta w ${col}`);
    // prywatne testy znikają całe (nie tylko odwołanie), katalog i wspólne zdjęcia zostają bez autora
    assert.equal((await q`SELECT count(*)::int AS n FROM strain_tests WHERE strain_id = ${strain}`)[0].n, 0);
    assert.equal((await q`SELECT count(*)::int AS n FROM strains WHERE id = ${strain} AND created_by IS NULL`)[0].n, 1);
    assert.equal((await q`SELECT count(*)::int AS n FROM strain_photos WHERE strain_id = ${strain} AND uploaded_by IS NULL`)[0].n, 1);
    // dane innych osób nietknięte
    assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${ids.bartek}`)[0].n, 1);
  }
});

// --- eksport konta ---

// Tabela -> klucz eksportu (account/export). Każda tabela z odwołaniem do users musi tu być albo na liście wyjątków.
const EXPORT_KEY = {
  users: 'profile', strains: 'strainsCreated', strain_photos: 'strainPhotosAdded', user_strain: 'entries', user_pool: 'remainingToBuy',
  usage_log: 'usage', purchases: 'purchases', strain_tests: 'tests', strain_edits: 'strainEdits', strain_proposals: 'strainProposals',
  friendships: 'friends', groups: 'groups', group_members: 'groups', group_messages: 'groupMessages', prescriptions: 'prescriptions', symptom_log: 'symptoms',
  symptom_custom: 'customSymptoms', symptom_values: 'customSymptomValues', doctor_notes: 'doctorNotes', beta_feedback: 'feedback', consent_log: 'consentLog', no_use_days: 'noUseDays',
  blocks: 'blocked', reports: 'reportsFiled', push_subscriptions: 'pushNotifications', push_prefs: 'pushNotifications', sessions: 'sessions',
};
const EXPORT_EXCEPTIONS = {
  invites: 'kody zaproszeń tworzy admin; to nie dane osobowe konta',
  push_sent: 'blokada powtórek przypomnień z bieżącego dnia (dane techniczne)',
  email_tokens: 'jednorazowe linki ważne 30 min; sam adres e-mail jest w profilu',
};

test('eksport konta obejmuje każdą tabelę z danymi użytkownika (poza opisanymi wyjątkami)', { skip }, async () => {
  const tables = [...new Set((await fkToUsers()).map((f) => f.t))];
  const missing = tables.filter((t) => !EXPORT_KEY[t] && !EXPORT_EXCEPTIONS[t]);
  assert.deepEqual(missing, [], 'nowa tabela z danymi użytkownika: dodaj do eksportu (account/export) i do EXPORT_KEY albo opisz wyjątek');
  const v = ids.celina;
  await populate(q, { v, o: ids.bartek, a: ids.ania });
  await q`INSERT INTO reports (reporter_id, target_user_id, type, reason, note) VALUES (${v}, ${ids.ania}, 'user', 'spam', 'mój opis zgłoszenia')`;
  jar.clear();
  await createSession(v);
  const mod = await import('../../app/api/account/export/route.js');
  const res = await mod.GET(new Request('http://localhost/api/account/export'));
  assert.equal(res.status, 200);
  const text = await res.text();
  const data = JSON.parse(text);
  for (const t of tables.filter((x) => EXPORT_KEY[x])) {
    const val = data[EXPORT_KEY[t]];
    assert.ok(val !== undefined, `${t}: brak klucza ${EXPORT_KEY[t]} w eksporcie`);
    const filled = Array.isArray(val) ? val.length > 0 : val && typeof val === 'object' ? Object.values(val).some((x) => (Array.isArray(x) ? x.length : x)) : !!val;
    assert.ok(filled, `${t}: eksport (${EXPORT_KEY[t]}) jest pusty mimo danych`);
  }
  assert.ok(data.reportsFiled.some((r) => r.note === 'mój opis zgłoszenia'));
  // zgłoszenia o tym koncie złożone przez innych (dane moderacji i zgłaszających) nie są ujawniane
  assert.ok(data.reportsFiled.every((r) => r.reason === 'spam'));
  assert.equal(data.reportsFiled.length, 2, 'tylko zgłoszenia wysłane przez właściciela');
  // sekrety i dane techniczne nie wychodzą
  for (const forbidden of ['password_hash', 'token_hash', 'sess-', 'fcm.googleapis.com']) assert.ok(!text.includes(forbidden), forbidden);
});
