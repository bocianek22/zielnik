// PAC-3: przypomnienia push - subskrypcje i preferencje (tylko własne), wybór przypomnień (recepta ≤7 dni,
// zapas ≤N dni, godzina, bez powtórek tego samego dnia), cron z podmienioną wysyłką, usuwanie po 410, treść dyskretna.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, push;
const ids = {};
const VAPID = { VAPID_PUBLIC_KEY: 'BPublicznyKluczTestowy', VAPID_PRIVATE_KEY: 'prywatny', VAPID_SUBJECT: 'mailto:test@example.com' };

async function call(uid, route, method, body, { headers = {}, params = {} } = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

let n = 0;
const sub = (host = 'fcm.googleapis.com') => ({
  endpoint: `https://${host}/fcm/send/urzadzenie-${++n}`,
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
});
const today = async () => (await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS d`)[0].d;

// Podmieniona wysyłka: zapisuje, co i dokąd poszło; fail(endpoint) -> kod błędu usługi push
function mockSender(fail = () => null) {
  const sent = [];
  const fn = async (s, json) => {
    const code = fail(s.endpoint);
    if (code) throw Object.assign(new Error(`push ${code}`), { statusCode: code });
    sent.push({ endpoint: s.endpoint, payload: JSON.parse(json) });
  };
  fn.sent = sent;
  return fn;
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  process.env.CRON_SECRET = 'sekret-crona';
  Object.assign(process.env, VAPID);
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  push = await import('../../lib/push.js');
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const name of ['ania', 'bartek', 'celina', 'darek']) {
    const r = await call(null, 'auth/register', 'POST', { username: name, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

beforeEach(() => { if (!skip) push.setPushSender(null); });
after(async () => { if (pool) await pool.end(); });

test('subskrypcja: walidacja adresu, tylko zalogowani, bez kluczy VAPID wyłączone', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(null, 'push/subscription', 'POST', { subscription: sub() })).status, 401);
  for (const bad of [
    { ...sub(), endpoint: 'http://fcm.googleapis.com/fcm/send/x' }, // bez https
    { ...sub(), endpoint: 'https://169.254.169.254/latest/meta-data' }, // nie usługa push (SSRF)
    { ...sub(), endpoint: 'https://fcm.googleapis.com.evil.example/x' },
    { ...sub(), keys: { p256dh: 'krótki', auth: 'x' } },
    { endpoint: 'nie-adres' },
  ]) {
    assert.equal((await call(A, 'push/subscription', 'POST', { subscription: bad })).status, 400, bad.endpoint);
  }
  assert.equal((await call(A, 'push/subscription', 'POST', { subscription: sub(), kind: 'apns' })).status, 400);
  const s = sub('web.push.apple.com');
  const r = await call(A, 'push/subscription', 'POST', { subscription: s });
  assert.deepEqual(r.json, { ok: true, owned: true });
  const [row] = await q`SELECT user_id, kind, keys FROM push_subscriptions WHERE endpoint = ${s.endpoint}`;
  assert.equal(row.user_id, A);
  assert.equal(row.kind, 'webpush');
  assert.deepEqual(row.keys, s.keys);
  // ponowny zapis tego samego urządzenia jest idempotentny, a przy zapisie powstają domyślne preferencje
  await call(A, 'push/subscription', 'POST', { subscription: s });
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${A}`)[0].n, 1);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_prefs WHERE user_id = ${A}`)[0].n, 1);

  delete process.env.VAPID_PRIVATE_KEY;
  try {
    assert.equal((await call(A, 'push/subscription', 'POST', { subscription: sub() })).status, 503);
    const c = await call(A, 'push/config', 'GET');
    assert.equal(c.json.enabled, false);
    assert.equal(c.json.publicKey, null);
    const cron = await call(null, 'cron/reminders', 'GET', null, { headers: { authorization: 'Bearer sekret-crona' } });
    assert.equal(cron.status, 200);
    assert.match(cron.json.skipped, /VAPID/);
  } finally { Object.assign(process.env, VAPID); }
  await q`DELETE FROM push_subscriptions`;
});

test('subskrypcje i preferencje: każdy zmienia tylko własne', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = sub();
  await call(A, 'push/subscription', 'POST', { subscription: s });
  // B nie usunie i samym odświeżeniem nie przejmie urządzenia A
  assert.deepEqual((await call(B, 'push/subscription', 'DELETE', { endpoint: s.endpoint })).json, { ok: true, removed: false });
  assert.deepEqual((await call(B, 'push/subscription', 'POST', { subscription: s })).json, { ok: true, owned: false });
  assert.equal((await q`SELECT user_id FROM push_subscriptions WHERE endpoint = ${s.endpoint}`)[0].user_id, A);
  // świadome włączenie na wspólnym urządzeniu przenosi je na nowe konto
  assert.deepEqual((await call(B, 'push/subscription', 'POST', { subscription: s, claim: true })).json, { ok: true, owned: true });
  assert.equal((await q`SELECT user_id FROM push_subscriptions WHERE endpoint = ${s.endpoint}`)[0].user_id, B);
  assert.deepEqual((await call(B, 'push/subscription', 'DELETE', { endpoint: s.endpoint })).json, { ok: true, removed: true });

  // preferencje: częściowa zmiana, walidacja, rozdzielne dla użytkowników
  assert.equal((await call(A, 'push/prefs', 'PUT', { notifyHour: 24 })).status, 400);
  assert.equal((await call(A, 'push/prefs', 'PUT', { stockDays: 0 })).status, 400);
  assert.equal((await call(A, 'push/prefs', 'PUT', { showDetails: 'tak' })).status, 400);
  const r = await call(A, 'push/prefs', 'PUT', { notifyHour: 20, showDetails: true });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.prefs, { notifyPrescription: true, notifyStock: true, stockDays: 5, notifyHour: 20, showDetails: true, devices: 0 });
  await call(A, 'push/prefs', 'PUT', { stockDays: 3 });
  const a = (await call(A, 'push/config', 'GET')).json;
  assert.equal(a.enabled, true);
  assert.equal(a.publicKey, VAPID.VAPID_PUBLIC_KEY);
  assert.equal(a.prefs.notifyHour, 20);
  assert.equal(a.prefs.stockDays, 3);
  const b = (await call(B, 'push/config', 'GET')).json;
  assert.deepEqual(b.prefs, { notifyPrescription: true, notifyStock: true, stockDays: 5, notifyHour: 9, showDetails: false, devices: 0 });
  assert.equal((await call(null, 'push/prefs', 'PUT', { notifyHour: 8 })).status, 401);
  await q`DELETE FROM push_prefs`;
});

test('wybór przypomnień: recepta ≤7 dni z niewykorzystanymi gramami, zapas ≤N dni, godzina', { skip }, async () => {
  const C = ids.celina;
  await call(C, 'push/subscription', 'POST', { subscription: sub() });
  const d = await today();
  // recepty: ważna 3 dni (10 g, wykupione 4 g) -> tak; 10 dni -> nie; wygasła -> nie; całkiem wykupiona -> nie
  await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams) VALUES
    (${C}, ${d}::date - 20, ${d}::date + 3, 10), (${C}, ${d}::date - 20, ${d}::date + 10, 10),
    (${C}, ${d}::date - 40, ${d}::date - 2, 10), (${C}, ${d}::date - 1, ${d}::date + 5, 2)`;
  await q`INSERT INTO purchases (user_id, strain_name, grams) VALUES (${C}, 'x', 4)`;
  const [rx] = await q`SELECT id FROM prescriptions WHERE user_id = ${C} AND valid_until = ${d}::date + 3`;
  let due = await push.dueReminders({ userId: C });
  assert.equal(due.length, 1);
  // ostatnia recepta (2 g) też łapie zakup 4 g z dziś, więc jest wykupiona - jak w prescriptionAlerts
  assert.deepEqual(due[0].items, [{ key: `rx:${rx.id}`, type: 'rx', validUntil: (await q`SELECT to_char(${d}::date + 3, 'YYYY-MM-DD') AS v`)[0].v, daysLeft: 3, remaining: 6 }]);

  // zapas: 10 g zużyte w ~10 dni = 1 g/dzień, na stanie 3 g -> 3 dni (próg domyślny 5)
  const [s] = await q`INSERT INTO strains (producer, name, type) VALUES ('Aurora', 'Tajna Odmiana', 'haze') RETURNING id`;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${s.id}, ${C}, 3)`;
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES
    (${C}, ${s.id}, 5, now() - interval '9 days 12 hours'), (${C}, ${s.id}, 5, now() - interval '1 day')`;
  due = await push.dueReminders({ userId: C });
  const stock = due[0].items.find((i) => i.type === 'stock');
  assert.deepEqual(stock, { key: 'stock', type: 'stock', daysLeft: 3, total: 3, perDay: 1 });
  await q`INSERT INTO push_prefs (user_id, stock_days) VALUES (${C}, 2) ON CONFLICT (user_id) DO UPDATE SET stock_days = 2`;
  assert.equal((await push.dueReminders({ userId: C }))[0].items.some((i) => i.type === 'stock'), false);
  await q`UPDATE push_prefs SET stock_days = 5, notify_prescription = FALSE WHERE user_id = ${C}`;
  assert.deepEqual((await push.dueReminders({ userId: C }))[0].items.map((i) => i.type), ['stock']);
  await q`UPDATE push_prefs SET notify_stock = FALSE WHERE user_id = ${C}`;
  assert.deepEqual(await push.dueReminders({ userId: C }), []);
  await q`UPDATE push_prefs SET notify_stock = TRUE, notify_prescription = TRUE WHERE user_id = ${C}`;

  // godzina (czas polski): przy cronie co godzinę wysyłka dopiero od wybranej godziny
  await q`UPDATE push_prefs SET notify_hour = 18 WHERE user_id = ${C}`;
  assert.deepEqual(await push.dueReminders({ userId: C, respectHour: true, hour: 17 }), []);
  assert.equal((await push.dueReminders({ userId: C, respectHour: true, hour: 18 })).length, 1);
  assert.equal((await push.dueReminders({ userId: C, respectHour: false, hour: 7 })).length, 1);
  await q`UPDATE push_prefs SET notify_hour = 9 WHERE user_id = ${C}`;

  // bez subskrypcji nie ma czego wysyłać
  assert.deepEqual(await push.dueReminders({ userId: ids.darek }), []);
});

test('cron: jedno zgrupowane, dyskretne powiadomienie na użytkownika i bez powtórek tego samego dnia', { skip }, async () => {
  const C = ids.celina;
  const second = sub();
  await call(C, 'push/subscription', 'POST', { subscription: second }); // drugie urządzenie Celiny
  const send = mockSender();
  push.setPushSender(send);
  assert.equal((await call(null, 'cron/reminders', 'GET')).status, 401);
  assert.equal((await call(null, 'cron/reminders', 'GET', null, { headers: { authorization: 'Bearer zly' } })).status, 401);
  const r = await call(null, 'cron/reminders', 'GET', null, { headers: { authorization: 'Bearer sekret-crona' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true, users: 1, notifications: 1, delivered: 2, failed: 0, removed: 0 });
  assert.equal(send.sent.length, 2); // jedno powiadomienie (recepta + zapas) na każde z 2 urządzeń
  for (const { payload } of send.sent) {
    assert.deepEqual(payload, { title: 'Zielnik', url: '/', tag: 'zielnik-przypomnienia',
      body: 'Masz 2 przypomnienia. Otwórz aplikację, aby zobaczyć szczegóły.' });
  }
  assert.equal((await q`SELECT count(*)::int AS n FROM push_sent WHERE user_id = ${C} AND sent_on = ${await today()}::date`)[0].n, 2);
  assert.ok((await q`SELECT bool_and(last_ok_at IS NOT NULL) AS ok FROM push_subscriptions WHERE user_id = ${C}`)[0].ok);
  // drugie wywołanie tego samego dnia nic nie wysyła
  const again = await push.sendReminders({ send });
  assert.equal(again.notifications, 0);
  assert.equal(send.sent.length, 2);
  // równoległe wywołania też nie dublują (rezerwacja w push_sent)
  await q`DELETE FROM push_sent`;
  const par = mockSender();
  const both = await Promise.all([push.sendReminders({ send: par }), push.sendReminders({ send: par })]);
  assert.equal(both[0].notifications + both[1].notifications, 1);
  assert.equal(par.sent.length, 2);
});

test('treść szczegółowa tylko na życzenie, nigdy z nazwą odmiany', { skip }, async () => {
  const C = ids.celina;
  await q`DELETE FROM push_sent`;
  await call(C, 'push/prefs', 'PUT', { showDetails: true });
  const send = mockSender();
  await push.sendReminders({ send, userId: C });
  const body = send.sent[0].payload.body;
  assert.match(body, /^Recepta ważna jeszcze 3 dni \(do \d\d\.\d\d\): zostało 6 g do wykupienia\.\nZapas wystarczy na ok\. 3 dni \(3 g\)\.$/);
  assert.doesNotMatch(body, /Tajna|Aurora/);
  await call(C, 'push/prefs', 'PUT', { showDetails: false });

  // sama recepta prowadzi do /recepty; odmiana liczby
  assert.equal(push.buildPayload([{ type: 'rx', key: 'rx:1', validUntil: '2026-10-05', daysLeft: 0, remaining: 1.25 }], true).url, '/recepty');
  assert.equal(push.buildPayload([{ type: 'rx', key: 'rx:1', validUntil: '2026-10-05', daysLeft: 0, remaining: 1.25 }], true).body,
    'Recepta wygasa dziś: zostało 1,3 g do wykupienia.');
  assert.equal(push.buildPayload([{ type: 'rx', key: 'rx:1' }]).body, 'Masz 1 przypomnienie. Otwórz aplikację, aby zobaczyć szczegóły.');
  assert.equal(push.buildPayload(Array.from({ length: 5 }, (_, i) => ({ type: 'rx', key: `rx:${i}` }))).body,
    'Masz 5 przypomnień. Otwórz aplikację, aby zobaczyć szczegóły.');
});

test('wygasła subskrypcja (404/410) jest usuwana, inne błędy liczone; bez dostarczenia przypomnienie wraca', { skip }, async () => {
  const C = ids.celina;
  await q`DELETE FROM push_sent`;
  const subs = await q`SELECT endpoint FROM push_subscriptions WHERE user_id = ${C} ORDER BY id`;
  assert.equal(subs.length, 2);
  const [gone, flaky] = subs.map((s) => s.endpoint);
  // jedno urządzenie wygasło, drugie ma chwilowy błąd: nic nie dotarło, więc rezerwacja zostaje zwolniona
  let send = mockSender((e) => (e === gone ? 410 : 500));
  let r = await push.sendReminders({ send, userId: C });
  assert.deepEqual(r, { users: 1, notifications: 0, delivered: 0, failed: 1, removed: 1 });
  assert.deepEqual((await q`SELECT endpoint, fails FROM push_subscriptions WHERE user_id = ${C}`), [{ endpoint: flaky, fails: 1 }]);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_sent`)[0].n, 0);
  // kolejna próba się udaje i zeruje licznik błędów
  send = mockSender();
  r = await push.sendReminders({ send, userId: C });
  assert.equal(r.notifications, 1);
  assert.equal((await q`SELECT fails FROM push_subscriptions WHERE endpoint = ${flaky}`)[0].fails, 0);
  // po MAX_FAILS kolejnych błędach urządzenie jest usuwane
  await q`UPDATE push_subscriptions SET fails = ${push.MAX_FAILS - 1} WHERE endpoint = ${flaky}`;
  await push.deliver(C, push.TEST_PAYLOAD, mockSender(() => 503));
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${C}`)[0].n, 0);
  // testowe powiadomienie przez API: 404 usuwa urządzenie i daje czytelny komunikat
  const s = sub();
  await call(C, 'push/subscription', 'POST', { subscription: s });
  push.setPushSender(mockSender(() => 404));
  const t = await call(C, 'push/test', 'POST');
  assert.equal(t.status, 502);
  assert.match(t.json.error, /wygasła/);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint = ${s.endpoint}`)[0].n, 0);
  await call(C, 'push/subscription', 'POST', { subscription: s });
  push.setPushSender(mockSender());
  assert.equal((await call(C, 'push/test', 'POST')).status, 200);
});

test('wylogowanie usuwa subskrypcję urządzenia, eksport i kopia bez adresów urządzeń, usunięcie konta kasuje wszystko', { skip }, async () => {
  const { celina: C, darek: D } = ids;
  const [{ endpoint }] = await q`SELECT endpoint FROM push_subscriptions WHERE user_id = ${C}`;
  // eksport: ustawienia i liczba urządzeń, bez endpointów i kluczy
  const ex = await call(C, 'account/export', 'GET');
  assert.equal(ex.status, 200);
  jar.clear(); await createSession(C);
  const exportMod = await import('../../app/api/account/export/route.js');
  const raw = await (await exportMod.GET(new Request('http://localhost/api/account/export'))).text();
  const data = JSON.parse(raw);
  assert.equal(data.pushNotifications.settings.notify_hour, 9);
  assert.equal(data.pushNotifications.devices.length, 1);
  assert.ok(!raw.includes(endpoint) && !raw.includes('p256dh'));
  const { buildBackup } = await import('../../lib/backup.js');
  const backup = JSON.stringify(await buildBackup());
  assert.ok(backup.includes('"push_prefs"') && !backup.includes(endpoint));

  // wylogowanie z adresem urządzenia: usuwa tylko własną subskrypcję
  const dSub = sub();
  await call(D, 'push/subscription', 'POST', { subscription: dSub });
  await call(C, 'auth/logout', 'POST', { pushEndpoint: dSub.endpoint });
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint = ${dSub.endpoint}`)[0].n, 1);
  await call(C, 'auth/logout', 'POST', { pushEndpoint: endpoint });
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE endpoint = ${endpoint}`)[0].n, 0);

  // usunięcie konta: subskrypcje, preferencje i znaczniki wysyłki znikają kaskadowo
  await call(D, 'push/prefs', 'PUT', { notifyStock: false });
  await q`INSERT INTO push_sent (user_id, key, sent_on) VALUES (${D}, 'stock', CURRENT_DATE)`;
  assert.equal((await call(D, 'account', 'DELETE', { password: 'haslo1234' })).status, 200);
  for (const t of ['push_subscriptions', 'push_prefs', 'push_sent']) {
    assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${t} WHERE user_id = $1`, [D])).rows[0].n, 0, t);
  }
  assert.deepEqual(await q`SELECT path, message FROM error_log`, []);
});
