// Lista dozwolonych hostów Web Push (ochrona przed SSRF): zapis subskrypcji i druga zapora przy wysyłce.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { setup, skip } from './harness.mjs';

let h, push;
const KEYS = { p256dh: 'BKluczPublicznyAbcdefgh', auth: 'sekretAuth1234' };
before(async () => {
  if (skip) return;
  h = await setup(['ania']);
  Object.assign(process.env, { VAPID_PUBLIC_KEY: 'BPublicznyKluczTestowy', VAPID_PRIVATE_KEY: 'prywatny', VAPID_SUBJECT: 'mailto:test@example.com' });
  push = await import('../../lib/push.js');
});
after(async () => { if (h) await h.pool.end(); });

const OK = [
  'https://fcm.googleapis.com/fcm/send/abc',
  'https://android.googleapis.com/gcm/send/abc',
  'https://updates.push.services.mozilla.com/wpush/v2/abc',
  'https://web.push.apple.com/QabC',
  'https://wns2-par02p.notify.windows.com/w/?token=abc',
  'https://FCM.GoogleAPIs.com/fcm/send/abc', // wielkość liter w hoście nie ma znaczenia
];
const BAD = [
  'http://fcm.googleapis.com/fcm/send/abc', // bez https
  'https://169.254.169.254/latest/meta-data', // adres metadanych chmury
  'https://localhost/x',
  'https://[::1]/x',
  'https://127.0.0.1/x',
  'https://fcm.googleapis.com.evil.example/x', // przyrostek zamiast poddomeny
  'https://evilfcm.googleapis.com.example/x',
  'https://notify.windows.com.evil.example/x',
  'https://evil-notify.windows.com/x', // brak kropki przed wpisem z listy
  'https://googleapis.com/x', // domena nadrzędna spoza listy
  'https://storage.googleapis.com/x', // inna usługa Google
  'https://apple.com/x',
  'https://mozilla.com/x',
  'https://user:haslo@fcm.googleapis.com/x', // dane logowania w adresie
  'https://fcm.googleapis.com:8443/x', // inny port
  'https://evil.example/@fcm.googleapis.com/x',
  'https://evil.example/?u=https://fcm.googleapis.com/x',
  'ftp://fcm.googleapis.com/x',
  'nie-adres',
  '',
];

test('isPushEndpoint: dozwolone usługi push przechodzą, reszta nie', { skip }, () => {
  for (const u of OK) assert.equal(push.isPushEndpoint(u), true, u);
  for (const u of BAD) assert.equal(push.isPushEndpoint(u), false, u);
  assert.equal(push.isPushEndpoint(undefined), false);
  assert.equal(push.isPushEndpoint(null), false);
});

test('POST /api/push/subscription: zły host to 400 i nic nie trafia do bazy, dobry host to zapis', { skip }, async () => {
  const { q, ids, call } = h;
  for (const endpoint of BAD.filter(Boolean)) {
    const r = await call(ids.ania, 'push/subscription', 'POST', { subscription: { endpoint, keys: KEYS } });
    assert.equal(r.status, 400, endpoint);
  }
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions`)[0].n, 0);
  for (const endpoint of OK) {
    const r = await call(ids.ania, 'push/subscription', 'POST', { subscription: { endpoint, keys: KEYS } });
    assert.equal(r.status, 200, endpoint);
  }
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions`)[0].n, OK.length);
});

test('wysyłka: subskrypcja z niedozwolonym hostem (np. sprzed listy) nie wywołuje żądania i jest usuwana', { skip }, async () => {
  const { q, ids } = h;
  await q`DELETE FROM push_subscriptions`;
  await q`INSERT INTO push_subscriptions (user_id, kind, endpoint, keys) VALUES (${ids.ania}, 'webpush', 'https://169.254.169.254/latest/meta-data', ${JSON.stringify(KEYS)}::jsonb)`;
  push.setPushSender(null);
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (...a) => { seen.push(a[0]); throw new Error('sieć niedostępna w teście'); };
  try {
    const out = await push.deliver(ids.ania, { title: 'x', body: 'y' });
    assert.equal(out.removed, 1);
    assert.equal(out.ok, 0);
  } finally { globalThis.fetch = realFetch; }
  assert.deepEqual(seen, []);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions`)[0].n, 0);
});
