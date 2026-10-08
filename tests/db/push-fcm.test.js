// Aplikacja natywna (mobile/): zapis tokenu FCM w push_subscriptions (kind 'fcm'), bez kluczy VAPID,
// tylko własne urządzenia, walidacja tokenu; wysyłka Web Push pomija tokeny FCM.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, push;
const ids = {};
const TOKEN = 'dQw4w9WgXcQ:APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx_Example-Token_0123456789abcdefghijklmnopqrstuvwxyz';

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

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  // bez kluczy VAPID: token aplikacji natywnej i tak ma się zapisać
  delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY; delete process.env.VAPID_SUBJECT;
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  push = await import('../../lib/push.js');
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('FCM', 10)`;
  for (const name of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: name, password: 'haslo1234', invite: 'fcm', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});
after(async () => { if (pool) await pool.end(); });

test('FCM: zapis tokenu bez VAPID, walidacja, tylko własne, pominięte przy wysyłce Web Push', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  assert.equal((await call(null, 'push/subscription', 'POST', { kind: 'fcm', token: TOKEN })).status, 401);
  for (const token of [undefined, '', 'krótki', 'https://evil.example/' + 'x'.repeat(30), 'a b'.repeat(20), 'x'.repeat(5000)]) {
    assert.equal((await call(A, 'push/subscription', 'POST', { kind: 'fcm', token })).status, 400, String(token).slice(0, 30));
  }
  // Web Push bez VAPID dalej wyłączony
  assert.equal((await call(A, 'push/subscription', 'POST', { subscription: { endpoint: 'https://fcm.googleapis.com/x' } })).status, 503);

  assert.deepEqual((await call(A, 'push/subscription', 'POST', { kind: 'fcm', token: TOKEN, claim: true })).json, { ok: true, owned: true });
  const [row] = await q`SELECT user_id, kind, endpoint, keys FROM push_subscriptions`;
  assert.deepEqual(row, { user_id: A, kind: 'fcm', endpoint: `fcm:${TOKEN}`, keys: {} });
  assert.equal((await call(A, 'push/config', 'GET')).json.prefs.devices, 1);

  // B nie przejmie urządzenia samym odświeżeniem i nie usunie cudzego
  assert.deepEqual((await call(B, 'push/subscription', 'POST', { kind: 'fcm', token: TOKEN })).json, { ok: true, owned: false });
  assert.deepEqual((await call(B, 'push/subscription', 'DELETE', { kind: 'fcm', token: TOKEN })).json, { ok: true, removed: false });

  // deliver() wysyła tylko Web Push: token FCM nie trafia do wysyłki VAPID
  const sent = [];
  const r = await push.deliver(A, { title: 'x' }, async (s) => { sent.push(s); });
  assert.deepEqual(r, { ok: 0, failed: 0, removed: 0, skipped: 1 }); // token FCM pominięty (brak konta Firebase)
  assert.equal(sent.length, 0);

  assert.deepEqual((await call(A, 'push/subscription', 'DELETE', { kind: 'fcm', token: TOKEN })).json, { ok: true, removed: true });
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions`)[0].n, 0);
});

test('FCM: wysyłka przypomnień i testu do tokenu, UNREGISTERED usuwa token, inne błędy są liczone', { skip }, async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const { resetFcmCache } = await import('../../lib/fcm.js');
  const { ania: A } = ids;
  const GOOD = 'good' + TOKEN, DEAD = 'dead' + TOKEN, FLAKY = 'flaky' + TOKEN;
  const realFetch = globalThis.fetch;
  const sent = [];
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') return reply(200, { access_token: 'tok', expires_in: 3600 });
    const m = JSON.parse(init.body).message;
    sent.push(m);
    if (m.token === DEAD) return reply(404, { error: { status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } });
    if (m.token === FLAKY) return reply(503, { error: { status: 'UNAVAILABLE' } });
    return reply(200, { name: 'projects/p/messages/1' });
  };
  try {
    // bez konta Firebase tokeny są pomijane: żadnych żądań ani błędów
    await q`DELETE FROM push_subscriptions`;
    for (const t of [GOOD, DEAD, FLAKY]) assert.equal((await call(A, 'push/subscription', 'POST', { kind: 'fcm', token: t, claim: true })).json.owned, true);
    assert.equal((await call(A, 'push/test', 'POST')).status, 503);
    assert.deepEqual(await push.deliver(A, push.TEST_PAYLOAD), { ok: 0, failed: 0, removed: 0, skipped: 3 });
    assert.equal(sent.length, 0);

    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'zielnik-test', client_email: 'p@zielnik-test.iam.gserviceaccount.com', private_key: privateKey });
    resetFcmCache();
    assert.equal((await call(A, 'push/config', 'GET')).json.fcm, true);

    // powiadomienie testowe: dobry dotarł, martwy usunięty, niestabilny (503) zostaje, bez zwiększania fails
    const t = await call(A, 'push/test', 'POST');
    assert.equal(t.status, 200, JSON.stringify(t.json));
    assert.deepEqual({ ok: t.json.ok, failed: t.json.failed, removed: t.json.removed }, { ok: 1, failed: 1, removed: 1 });
    assert.deepEqual((await q`SELECT endpoint, fails FROM push_subscriptions ORDER BY endpoint`).map((r) => [r.endpoint, r.fails]),
      [[`fcm:${FLAKY}`, 0], [`fcm:${GOOD}`, 0]]);
    const m = sent.find((x) => x.token === GOOD);
    assert.deepEqual(m.notification, { title: 'Zielnik', body: push.TEST_PAYLOAD.body });
    assert.equal(m.data.url, '/profil');

    // przypomnienie z crona: neutralna treść (bez szczegółów i nazw odmian) trafia na token FCM
    sent.length = 0;
    const [{ d }] = await q`SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d`;
    await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES (${A}, ${d}::date - 10, ${d}::date + 2, 10)`;
    const stats = await push.sendReminders({ userId: A, respectHour: false });
    assert.equal(stats.notifications, 1);
    const rem = sent.find((x) => x.token === GOOD);
    assert.equal(rem.notification.body, 'Masz 1 przypomnienie. Otwórz aplikację, aby zobaczyć szczegóły.');
    assert.equal(rem.data.url, '/recepty');
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.FIREBASE_SERVICE_ACCOUNT;
    resetFcmCache();
  }
});

test('FCM: błędy usługi nie zwiększają fails, treść bez szczegółów mimo showDetails, test bez konfiguracji daje 503', { skip }, async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } });
  const { resetFcmCache } = await import('../../lib/fcm.js');
  const { bartek: B } = ids;
  const T = 'svc' + TOKEN;
  const realFetch = globalThis.fetch, realErr = console.error;
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  let mode = 'ok', oauth = 200; const sent = [];
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://oauth2.googleapis.com/token') return oauth === 200 ? reply(200, { access_token: 'tok', expires_in: 3600 }) : reply(oauth, {});
    sent.push(JSON.parse(init.body).message);
    return mode === 'ok' ? reply(200, {}) : reply(Number(mode), { error: { status: 'X' } });
  };
  console.error = () => {};
  try {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'p', client_email: 'p@p.iam.gserviceaccount.com', private_key: privateKey });
    resetFcmCache();
    await q`DELETE FROM push_subscriptions`;
    await call(B, 'push/subscription', 'POST', { kind: 'fcm', token: T, claim: true });
    const fails = async () => (await q`SELECT fails FROM push_subscriptions WHERE user_id = ${B}`)[0].fails;
    for (const m of ['403', '429', '503']) { mode = m; assert.equal((await push.deliver(B, { title: 'x' })).failed, 1); }
    assert.equal(await fails(), 0);
    mode = '400'; await push.deliver(B, { title: 'x' }); // błąd 400 niedotyczący tokenu jest liczony
    assert.equal(await fails(), 1);
    mode = 'ok'; oauth = 500; resetFcmCache();
    assert.equal((await push.deliver(B, { title: 'x' })).failed, 1);
    const r = await push.deliver(B, { title: 'x' }); // negatywny cache: pominięte, bez błędu
    assert.deepEqual(r, { ok: 0, failed: 0, removed: 0, skipped: 1 });
    assert.equal(await fails(), 1);
    oauth = 200; resetFcmCache();

    // szczegóły włączone: FCM i tak dostaje neutralną treść
    await call(B, 'push/prefs', 'PUT', { showDetails: true });
    const [{ d }] = await q`SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d`;
    await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES (${B}, ${d}::date - 10, ${d}::date + 2, 10)`;
    sent.length = 0;
    assert.equal((await push.sendReminders({ userId: B, respectHour: false })).notifications, 1);
    assert.equal(sent[0].notification.body, 'Masz 1 przypomnienie. Otwórz aplikację, aby zobaczyć szczegóły.');

    // test: jedyna subskrypcja jest rodzaju bez konfiguracji (Web Push bez VAPID) = czytelny 503, nie 502
    await q`DELETE FROM push_subscriptions`;
    await q`INSERT INTO push_subscriptions (user_id, kind, endpoint, keys) VALUES (${B}, 'webpush', 'https://fcm.googleapis.com/wp/x', '{}'::jsonb)`;
    const t = await call(B, 'push/test', 'POST');
    assert.equal(t.status, 503);
    assert.match(t.json.error, /nie są jeszcze skonfigurowane/);
  } finally {
    globalThis.fetch = realFetch; console.error = realErr;
    delete process.env.FIREBASE_SERVICE_ACCOUNT; resetFcmCache();
  }
});
