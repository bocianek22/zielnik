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
    const r = await call(null, 'auth/register', 'POST', { username: name, password: 'haslo1234', invite: 'fcm', adult: true, consent: true });
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
  assert.deepEqual(r, { ok: 0, failed: 0, removed: 0 });
  assert.equal(sent.length, 0);

  assert.deepEqual((await call(A, 'push/subscription', 'DELETE', { kind: 'fcm', token: TOKEN })).json, { ok: true, removed: true });
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions`)[0].n, 0);
});
