// Beta D: panel „Gotowość” (stan konfiguracji bez wartości), /api/health, znacznik ostatniego crona.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

// wartości-wabiki: żadna nie może się pojawić w odpowiedzi panelu
const SECRETS = {
  AUTH_SECRET: 'sekret-sesji-WABIK-0123456789-0123456789-0123',
  BACKUP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_WABIK_token',
  APP_URL: 'https://wabik-aplikacja.example',
  RESEND_API_KEY: 're_WABIK_klucz',
  MAIL_FROM: 'Zielnik <wabik@nadawca.example>',
  VAPID_PUBLIC_KEY: 'BWABIK-publiczny',
  VAPID_PRIVATE_KEY: 'WABIK-prywatny-vapid',
  VAPID_SUBJECT: 'mailto:wabik@vapid.example',
  CRON_SECRET: 'cron-WABIK-sekret-0123456789',
  ALERT_WEBHOOK_URL: 'https://hooks.wabik.example/webhook/TAJNY',
  ANTHROPIC_API_KEY: 'sk-ant-WABIK',
  BETA_GROUP_URL: 'https://grupa.wabik.example/zaproszenie',
  SUGGEST_DOMAINS: 'wabik-serwis.example',
  PHOTOS_BLOB: '1',
};
const saved = {};
let q, pool, jar, createSession, adminId, userId;

async function get(route, uid, headers = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const res = await mod.GET(new Request(`http://localhost/api/${route}`, { headers }));
  return { res, json: (res.headers.get('content-type') || '').includes('json') ? await res.json() : null };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  for (const k of Object.keys(SECRETS)) saved[k] = process.env[k];
  Object.assign(process.env, SECRETS);
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  await db.ensureDb();
  q = db.sql();
  adminId = (await q`SELECT id FROM users WHERE lower(username) = 'bocian'`)[0].id;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${adminId}`;
  userId = (await q`INSERT INTO users (username, password_hash, must_change_password) VALUES ('zwykly', 'x', FALSE) RETURNING id`)[0].id;
});

after(async () => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  if (pool) await pool.end();
});

test('gotowość: tylko admin (anonim 401, zwykły użytkownik 403)', { skip }, async () => {
  assert.equal((await get('admin/readiness', null)).res.status, 401);
  assert.equal((await get('admin/readiness', userId)).res.status, 403);
  assert.equal((await get('admin/readiness', adminId)).res.status, 200);
});

test('gotowość: odpowiedź nie zawiera żadnej wartości sekretu', { skip }, async () => {
  const { res, json } = await get('admin/readiness', adminId);
  assert.equal(res.status, 200);
  const text = JSON.stringify(json);
  for (const [k, v] of Object.entries(SECRETS)) {
    if (k === 'PHOTOS_BLOB') continue; // przełącznik '1', nie sekret
    assert.ok(!text.includes(v), `${k}: wartość wyciekła do odpowiedzi`);
  }
  for (const frag of ['wabik', 'WABIK', 'TAJNY', 'hooks.', 'nadawca.example']) assert.ok(!text.includes(frag), frag);
  // kształt: tylko id, nazwa, stan, wskazówka
  for (const c of json.checks) {
    assert.deepEqual(Object.keys(c).sort(), ['hint', 'id', 'label', 'optional', 'state']);
    assert.ok(['ok', 'missing', 'weak'].includes(c.state));
  }
  assert.match(json.postgres, /^\d+/);
  assert.equal(typeof json.errors24h.server, 'number');
});

test('gotowość: stany ok / brak / słabe zależą od konfiguracji', { skip }, async () => {
  const st = async () => Object.fromEntries((await get('admin/readiness', adminId)).json.checks.map((c) => [c.id, c.state]));
  let s = await st();
  assert.equal(s.auth, 'ok'); assert.equal(s['backup-key'], 'ok'); assert.equal(s.mail, 'ok'); assert.equal(s.vapid, 'ok');
  assert.equal(s.cron, 'ok'); assert.equal(s.alerts, 'ok'); assert.equal(s['app-url'], 'ok'); assert.equal(s.blob, 'ok');
  assert.equal(s.suggest, 'weak', 'SUGGEST_DOMAINS ustawione = ostrzeżenie');
  process.env.AUTH_SECRET = 'x'.repeat(20);
  process.env.BACKUP_ENCRYPTION_KEY = 'za-krotki';
  process.env.CRON_SECRET = 'krotki';
  process.env.RESEND_API_KEY = '';
  delete process.env.VAPID_PRIVATE_KEY;
  process.env.APP_URL = 'http://zwykly-http.example';
  delete process.env.ALERT_WEBHOOK_URL;
  delete process.env.SUGGEST_DOMAINS;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  s = await st();
  assert.equal(s.auth, 'weak'); assert.equal(s['backup-key'], 'weak'); assert.equal(s.cron, 'weak');
  assert.equal(s.mail, 'weak'); assert.equal(s.vapid, 'weak'); assert.equal(s['app-url'], 'weak');
  assert.equal(s.alerts, 'missing'); assert.equal(s.suggest, 'ok'); assert.equal(s.blob, 'weak');
  assert.equal(s['photos-blob'], 'weak', 'PHOTOS_BLOB=1 bez tokenu');
  Object.assign(process.env, SECRETS);
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal((await st()).anthropic, 'missing');
  process.env.ANTHROPIC_API_KEY = SECRETS.ANTHROPIC_API_KEY;
});

test('gotowość: ostatnia kopia i znacznik crona przypomnień', { skip }, async () => {
  assert.equal((await get('admin/readiness', adminId)).json.lastBackup, null);
  assert.equal((await get('admin/readiness', adminId)).json.crons.reminders, undefined);
  await q`INSERT INTO backups (kind, size, data) VALUES ('auto', 10, '{}')`;
  // cron bez push (brak VAPID/FCM) też zapisuje znacznik: przebieg się odbył
  const keep = ['VAPID_PRIVATE_KEY', 'VAPID_PUBLIC_KEY', 'VAPID_SUBJECT'].map((k) => [k, process.env[k]]);
  for (const [k] of keep) delete process.env[k];
  jar.clear();
  const cron = await import('../../app/api/cron/reminders/route.js');
  const denied = await cron.GET(new Request('http://localhost/api/cron/reminders'));
  assert.equal(denied.status, 401);
  assert.equal((await q`SELECT count(*)::int AS n FROM schema_meta WHERE key = 'cron:reminders'`)[0].n, 0, 'odmowa nie zapisuje znacznika');
  const ok = await cron.GET(new Request('http://localhost/api/cron/reminders', { headers: { authorization: `Bearer ${SECRETS.CRON_SECRET}` } }));
  assert.equal(ok.status, 200);
  for (const [k, v] of keep) process.env[k] = v;
  const r = (await get('admin/readiness', adminId)).json;
  assert.equal(r.lastBackup.kind, 'auto');
  assert.equal(r.lastBackup.blob, false);
  assert.ok(Math.abs(Date.now() - new Date(r.crons.reminders).getTime()) < 60000);
  // znacznik leży w schema_meta: poza kopią i eksportem, więc nic nowego nie trafia do danych użytkownika
  const { BACKUP_EXCLUDED } = await import('../../lib/backup.js');
  assert.ok(BACKUP_EXCLUDED.includes('schema_meta'));
});

test('gotowość: liczba błędów w 24 h (serwer i przeglądarka osobno)', { skip }, async () => {
  await q`DELETE FROM error_log`;
  await q`INSERT INTO error_log (source, message) VALUES ('api', 'a'), ('api', 'b'), ('przeglądarka', 'c')`;
  await q`INSERT INTO error_log (source, message, at) VALUES ('api', 'stary', now() - interval '3 days')`;
  const r = (await get('admin/readiness', adminId)).json;
  assert.deepEqual(r.errors24h, { server: 2, browser: 1 });
});

test('/api/health: publiczne, no-store, bez danych użytkowników, tylko ok/db/schema/version', { skip }, async () => {
  const { res, json } = await get('health', null);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.deepEqual(Object.keys(json).sort(), ['db', 'ok', 'schema', 'version']);
  assert.equal(json.ok, true); assert.equal(json.db, true); assert.equal(json.schema, 'zgodny');
  assert.equal(json.version, (await import('../../lib/version.js')).VERSION);
  assert.ok(!JSON.stringify(json).includes('zwykly'));
});

test('/api/health: niezgodna suma schematu = 503, po zgodności 200', { skip }, async () => {
  const db = await import('../../lib/db.js');
  await q`UPDATE schema_meta SET value = 'stara' WHERE key = 'schema'`;
  // ensureDb() w tym procesie jest już „gotowe”, więc test sprawdza samo porównanie sumy: niezgodna = 503
  const { res, json } = await get('health', null);
  assert.equal(res.status, 503);
  assert.equal(json.ok, false); assert.equal(json.db, true); assert.equal(json.schema, 'niezgodny');
  await q`UPDATE schema_meta SET value = ${db.SCHEMA_HASH} WHERE key = 'schema'`;
  assert.equal((await get('health', null)).res.status, 200);
});

test('/api/health: baza niedostępna = 503, db: false, bez treści błędu', { skip }, async () => {
  const orig = pool.query.bind(pool);
  pool.query = async () => { throw new Error('connect ECONNREFUSED 10.0.0.1:5432 haslo=tajne'); };
  let out;
  try { out = await get('health', null); } finally { pool.query = orig; }
  assert.equal(out.res.status, 503);
  assert.deepEqual(out.json, { ok: false, db: false, schema: 'niezgodny', version: out.json.version });
  assert.ok(!JSON.stringify(out.json).includes('tajne'));
  assert.equal((await get('health', null)).res.status, 200);
});

test('/api/health: limit zapytań na IP (429), inny adres nie jest dotknięty', { skip }, async () => {
  const { client } = await import('./headers-shim.mjs');
  await q`DELETE FROM rate_limits`;
  client.ip = '203.0.113.9';
  try {
    for (let i = 0; i < 120; i++) assert.equal((await get('health', null)).res.status, 200);
    const over = await get('health', null);
    assert.equal(over.res.status, 429);
    assert.match(over.res.headers.get('cache-control'), /no-store/);
    client.ip = '203.0.113.10';
    assert.equal((await get('health', null)).res.status, 200);
  } finally { client.ip = '127.0.0.1'; }
});
