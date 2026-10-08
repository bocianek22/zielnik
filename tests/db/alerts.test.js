// PLA-2: alerty o błędach serwera (webhook i e-mail) z dziennika error_log: progi, nowy rodzaj, ograniczenie
// częstotliwości, brak treści błędu w alercie, pomijanie błędów z przeglądarki.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const SECRET = 'objawy: bol glowy, THC 22% (dane z zadania)';
let q, pool, logError, alerts, mail, realFetch, jar;
const hooks = [];
const outbox = [];

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  await db.ensureDb();
  q = db.sql();
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('haslo1234', 4);
  await q`INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES ('szef', ${hash}, TRUE, FALSE), ('zwykly', ${hash}, FALSE, FALSE)`;
  const errorlog = await import('../../lib/errorlog.js');
  alerts = await import('../../lib/alerts.js');
  mail = await import('../../lib/mail.js');
  // alerty idą w tle (after()): test czeka na ich zakończenie
  logError = async (...a) => { await errorlog.logError(...a); await mail.flushBackground(); };
  mail.setMailTransport(async (m) => { outbox.push(m); });
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    hooks.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(null, { status: 204 });
  };
});

beforeEach(async () => {
  if (skip) return;
  hooks.length = 0;
  outbox.length = 0;
  for (const k of ['ALERT_WEBHOOK_URL', 'ALERT_EMAIL', 'ALERT_THRESHOLD', 'RESEND_API_KEY', 'MAIL_FROM']) delete process.env[k];
  await q`DELETE FROM error_log`;
  await q`DELETE FROM rate_limits WHERE key LIKE 'alert%'`;
});

after(async () => {
  if (realFetch) globalThis.fetch = realFetch;
  if (mail) mail.setMailTransport(null);
  for (const k of ['ALERT_WEBHOOK_URL', 'ALERT_EMAIL', 'ALERT_THRESHOLD', 'RESEND_API_KEY', 'MAIL_FROM']) delete process.env[k];
  if (pool) await pool.end();
});

test('bez ALERT_WEBHOOK_URL i ALERT_EMAIL: błędy zapisują się, alertów brak', { skip }, async () => {
  for (let i = 0; i < 8; i++) await logError('api', new Error('x'), { path: '/api/a' });
  assert.equal((await q`SELECT count(*)::int AS n FROM error_log`)[0].n, 8);
  assert.equal(hooks.length + outbox.length, 0);
  assert.equal(alerts.alertsEnabled(), false);
  // webhook tylko https
  process.env.ALERT_WEBHOOK_URL = 'http://hooks.slack.com/x';
  assert.equal(alerts.alertsEnabled(), false);
});

test('nowy rodzaj błędu: jeden alert bez treści błędu; ten sam rodzaj (inne liczby) już nie', { skip }, async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/x';
  await logError('api', new Error(`${SECRET} id 12`), { path: '/api/strains/12?q=tajne' });
  assert.equal(hooks.length, 1);
  const text = hooks[0].body.text;
  assert.ok(text);
  assert.equal('content' in hooks[0].body, false, 'Slack dostaje tylko `text`');
  assert.match(text, /Nowy rodzaj błędu/);
  assert.match(text, /api/);
  assert.equal(text.includes('bol glowy') || text.includes('THC') || text.includes('tajne'), false, text);
  await logError('api', new Error(`${SECRET} id 99`), { path: '/api/strains/12' });
  assert.equal(hooks.length, 1);
  // inny komunikat = nowy rodzaj
  await logError('api', new Error('timeout'), { path: '/api/strains/12' });
  assert.equal(hooks.length, 2);
});

test('błędy z przeglądarki i błędy alertów nie wywołują alertów', { skip }, async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/abc';
  for (let i = 0; i < 10; i++) await logError('przeglądarka', `atak ${i} ${Math.random()}`, { path: '/x' });
  await logError('alert', 'Alert webhook: HTTP 500');
  assert.equal(hooks.length, 0);
});

test('próg: N błędów w 15 min daje alert z liczbą i ścieżkami; kolejny dopiero po 15 min; Discord dostaje `content`', { skip }, async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://discord.com/api/webhooks/1/abc';
  process.env.ALERT_THRESHOLD = '4';
  await logError('api', new Error(SECRET), { path: '/api/a' }); // nowy rodzaj
  for (let i = 0; i < 2; i++) await logError('api', new Error(SECRET), { path: '/api/a' });
  assert.equal(hooks.length, 1);
  await logError('route', new Error(SECRET), { path: '/api/b' }); // 4. błąd: próg
  assert.equal(hooks.length, 2);
  const body = hooks[1].body;
  assert.deepEqual(Object.keys(body), ['content']);
  assert.match(body.content, /4 błędów serwera w 15 min/);
  assert.match(body.content, /api \/api\/a: 3/);
  assert.equal(body.content.includes('bol glowy'), false);
  for (let i = 0; i < 10; i++) await logError('api', new Error(SECRET), { path: '/api/a' });
  assert.equal(hooks.length, 2, 'najwyżej jeden alert progowy na 15 min');
  // po 15 minutach kolejny
  await q`UPDATE rate_limits SET reset_at = now() - interval '1 second' WHERE key = 'alert:burst'`;
  await logError('api', new Error(SECRET), { path: '/api/a' });
  assert.equal(hooks.length, 3);
});

test('nowe rodzaje: najwyżej 3 alerty na godzinę', { skip }, async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/x';
  process.env.ALERT_THRESHOLD = '1000';
  for (const m of ['a', 'b', 'c', 'd', 'e']) await logError('api', new Error(`rodzaj ${m}`), { path: '/api/x' });
  assert.equal(hooks.length, 3);
});

test('kanał e-mail: ALERT_EMAIL działa tylko z wysyłką e-maili; nieudana wysyłka zapisuje wpis „alert” bez pętli', { skip }, async () => {
  process.env.ALERT_EMAIL = 'admin@example.test';
  assert.equal(alerts.alertsEnabled(), false, 'bez RESEND_API_KEY i MAIL_FROM e-mail wyłączony');
  Object.assign(process.env, { RESEND_API_KEY: 're_test', MAIL_FROM: 'Notatnik <n@example.test>' });
  assert.deepEqual(alerts.alertChannels(), { webhook: false, email: true });
  await logError('serwer', new Error(SECRET), { path: '/raport' });
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'admin@example.test');
  assert.match(outbox[0].subject, /Nowy rodzaj błędu/);
  assert.equal(outbox[0].text.includes('bol glowy'), false);
  // nieudana wysyłka: wpis „alert” w dzienniku, bez pętli alertów
  mail.setMailTransport(async () => { throw new Error('Wysyłka e-mail: HTTP 500'); });
  try {
    const sent = await alerts.sendAlert('[Zielnik] test', ['x']);
    assert.deepEqual(sent, { webhook: null, email: false });
    assert.equal((await q`SELECT count(*)::int AS n FROM error_log WHERE source = 'alert'`)[0].n, 1);
  } finally {
    mail.setMailTransport(async (m) => { outbox.push(m); });
  }
});

test('ścieżka w alercie bez nazwy konta i identyfikatorów; /api/strains/12 i /13 to ten sam rodzaj', { skip }, async () => {
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/x';
  process.env.ALERT_THRESHOLD = '1000';
  assert.equal(alerts.alertPath('/u/kasia.k/oceny'), '/u/:handle/oceny');
  assert.equal(alerts.alertPath('/api/account/sessions/abcdefghijklmnopqrstuv'), '/api/account/sessions/:id');
  assert.equal(alerts.alertPath('/api/strains/12/tests?x=1'), '/api/strains/:id/tests');
  await logError('render', new Error('boom'), { path: '/u/someuser' });
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0].body.text.includes('someuser'), false, hooks[0].body.text);
  assert.match(hooks[0].body.text, /\/u\/:handle/);
  await logError('render', new Error('boom'), { path: '/u/innaosoba' });
  await logError('api', new Error('zly stan'), { path: '/api/strains/12' });
  await logError('api', new Error('zly stan'), { path: '/api/strains/13' });
  assert.equal(hooks.length, 2, 'ta sama trasa z innym identyfikatorem to nie nowy rodzaj');
});

async function asUser(username) {
  jar.clear();
  const mod = await import('../../app/api/auth/login/route.js');
  const r = await mod.POST(new Request('http://localhost/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password: 'haslo1234' }) }));
  assert.equal(r.status, 200);
}
async function adminAlerts(method) {
  const mod = await import('../../app/api/admin/alerts/route.js');
  const r = await mod[method](new Request('http://localhost/api/admin/alerts', { method }));
  return { status: r.status, json: await r.json() };
}

test('admin/alerts: tylko admin; stan bez adresu webhooka; alert próbny 503 bez kanałów, potem wysyłka i limit 3 na 10 min', { skip }, async () => {
  await asUser('zwykly');
  assert.equal((await adminAlerts('GET')).status, 403);
  assert.equal((await adminAlerts('POST')).status, 403);
  await asUser('szef');
  assert.equal((await adminAlerts('POST')).status, 503);
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/tajny-klucz';
  const g = await adminAlerts('GET');
  assert.deepEqual(g.json, { channels: { webhook: true, email: false }, threshold: 5 });
  assert.equal(JSON.stringify(g.json).includes('tajny'), false);
  const codes = [];
  for (let i = 0; i < 4; i++) codes.push(await adminAlerts('POST'));
  assert.deepEqual(codes.map((c) => c.status), [200, 200, 200, 429]);
  assert.deepEqual(codes[0].json.sent, { webhook: true, email: null });
  assert.equal(hooks.length, 3);
  assert.match(hooks[0].body.text, /Alert próbny/);
});
