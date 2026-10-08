// POM-05 / POM-15: wieczorne przypomnienie o objawach i przypomnienie o wizycie - kto dostaje (domyślnie nikt),
// godzina i okno, brak wpisu dziś (wbudowanego i własnego), strefa Europe/Warsaw, deduplikacja, tryb dyskretny, brak kluczy push.
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

async function call(uid, route, method, body, { headers = {} } = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve({}) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

let n = 0;
const sub = () => ({
  endpoint: `https://fcm.googleapis.com/fcm/send/przyp-${++n}`,
  keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' },
});
const day = async (offset = 0) => (await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date + ${offset}::int, 'YYYY-MM-DD') AS d`)[0].d;
const keys = async (uid, opts) => (await push.dueReminders({ userId: uid, ...opts })).flatMap((u) => u.items.map((i) => i.key));

function mockSender() {
  const sent = [];
  const fn = async (s, json) => { sent.push({ endpoint: s.endpoint, payload: JSON.parse(json) }); };
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
  for (const name of ['ania', 'bartek', 'celina']) {
    const r = await call(null, 'auth/register', 'POST', { username: name, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
  for (const id of [ids.ania, ids.bartek]) await call(id, 'push/subscription', 'POST', { subscription: sub() });
});

beforeEach(async () => {
  if (skip) return;
  push.setPushSender(null);
  await q`DELETE FROM push_sent`;
  await q`DELETE FROM symptom_log`;
  await q`DELETE FROM symptom_custom`;
  await q`UPDATE push_prefs SET notify_symptoms = FALSE, symptoms_hour = 21, notify_visit = FALSE, next_visit_on = NULL, show_details = FALSE, notify_hour = 9`;
});
after(async () => { if (pool) await pool.end(); });

test('domyślnie nic nie jest włączone: ani objawy, ani wizyta', { skip }, async () => {
  const A = ids.ania;
  const c = (await call(A, 'push/config', 'GET')).json;
  assert.equal(c.prefs.notifySymptoms, false);
  assert.equal(c.prefs.notifyVisit, false);
  assert.equal(c.prefs.symptomsHour, 21);
  assert.equal(c.prefs.nextVisit, null);
  // nawet z datą wizyty na jutro i w godzinie wieczornej: bez zgody użytkownika cisza
  await q`UPDATE push_prefs SET next_visit_on = ${await day(1)}::date WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 21 }), []);
});

test('ustawienia: walidacja, częściowy zapis, usuwanie daty, rozdzielne konta, eksport', { skip }, async () => {
  const { ania: A, bartek: B, celina: C } = ids;
  for (const bad of [{ symptomsHour: 12 }, { symptomsHour: 23 }, { symptomsHour: 20.5 }, { notifySymptoms: 'tak' }, { notifyVisit: 1 },
    { nextVisit: '2026-02-30' }, { nextVisit: 'jutro' }, { nextVisit: '1999-01-01' }]) {
    assert.equal((await call(A, 'push/prefs', 'PUT', bad)).status, 400, JSON.stringify(bad));
  }
  const d = await day(2);
  const r = await call(A, 'push/prefs', 'PUT', { notifySymptoms: true, symptomsHour: 22, notifyVisit: true, nextVisit: d });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual([r.json.prefs.notifySymptoms, r.json.prefs.symptomsHour, r.json.prefs.notifyVisit, r.json.prefs.nextVisit], [true, 22, true, d]);
  // zmiana innego pola nie rusza daty; null/'' ją usuwa
  assert.equal((await call(A, 'push/prefs', 'PUT', { stockDays: 4 })).json.prefs.nextVisit, d);
  assert.equal((await call(A, 'push/prefs', 'PUT', { nextVisit: '' })).json.prefs.nextVisit, null);
  assert.equal((await call(A, 'push/prefs', 'PUT', { nextVisit: d })).json.prefs.nextVisit, d);
  assert.equal((await call(A, 'push/prefs', 'PUT', { nextVisit: null })).json.prefs.nextVisit, null);
  // drugie konto nic nie widzi
  const b = (await call(B, 'push/config', 'GET')).json.prefs;
  assert.deepEqual([b.notifySymptoms, b.symptomsHour, b.nextVisit], [false, 21, null]);
  // zapis ustawień u użytkownika bez wiersza push_prefs tworzy go (reszta domyślnie)
  const rc = await call(C, 'push/prefs', 'PUT', { notifySymptoms: true, nextVisit: d });
  assert.equal(rc.status, 200);
  assert.equal(rc.json.prefs.notifyPrescription, true);
  assert.equal(rc.json.prefs.nextVisit, d);
  // eksport zawiera nowe ustawienia
  await call(C, 'push/prefs', 'PUT', { notifyVisit: true });
  jar.clear(); await createSession(C);
  const ex = await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export'));
  assert.equal(ex.status, 200);
  const s = (await ex.json()).pushNotifications.settings;
  assert.deepEqual([s.notify_symptoms, s.notify_visit, s.next_visit_on, s.symptoms_hour], [true, true, d, 21]);
  await q`DELETE FROM push_prefs WHERE user_id = ${C}`;
});

test('objawy: tylko po włączeniu, w oknie godzin trybu godzinowego i gdy dziś brak wpisu', { skip }, async () => {
  const A = ids.ania;
  await q`UPDATE push_prefs SET notify_symptoms = TRUE, symptoms_hour = 20 WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 19 }), []);
  assert.deepEqual(await keys(A, { respectHour: true, hour: 20 }), ['symptoms']);
  assert.deepEqual(await keys(A, { respectHour: true, hour: 22 }), ['symptoms']);
  assert.deepEqual(await keys(A, { respectHour: true, hour: 23 }), []); // okno 3 godzin: nie dogania spóźnionego crona
  // cron raz dziennie (rano): wieczorne przypomnienie nie ma sensu, więc nie idzie
  assert.deepEqual(await keys(A, { respectHour: false, hour: 21 }), []);

  // wpis dziś (wbudowany) wycisza; pusty wiersz (same NULL) nie
  const d = await day();
  await q`INSERT INTO symptom_log (user_id, day) VALUES (${A}, ${d}::date)`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 21 }), ['symptoms']);
  await q`UPDATE symptom_log SET mood = 0 WHERE user_id = ${A}`; // 0 to też wpis
  assert.deepEqual(await keys(A, { respectHour: true, hour: 21 }), []);
  // wpis z wczoraj nie liczy się
  await q`UPDATE symptom_log SET day = ${await day(-1)}::date WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 21 }), ['symptoms']);
  // sama notatka jest wpisem
  await q`UPDATE symptom_log SET day = ${d}::date, mood = NULL, note = 'ok' WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 21 }), []);
  await q`DELETE FROM symptom_log`;
  // własny objaw dziś też wycisza
  const [c] = await q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${A}, 1, 'Apetyt') RETURNING id`;
  await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${c.id}, ${A}, ${d}::date, 4)`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 21 }), []);
  // inny użytkownik (bez włączenia) nie dostaje
  assert.deepEqual(await keys(ids.bartek, { respectHour: true, hour: 21 }), []);
});

test('wizyta: dzień wcześniej i w dniu, w strefie Europe/Warsaw, niezależnie od objawów', { skip }, async () => {
  const A = ids.ania;
  await q`UPDATE push_prefs SET notify_visit = TRUE WHERE user_id = ${A}`;
  const at = async (off) => { await q`UPDATE push_prefs SET next_visit_on = ${await day(off)}::date WHERE user_id = ${A}`; return keys(A); };
  assert.deepEqual(await at(1), ['visit:1']); // "dziś" liczone wg czasu polskiego, nie UTC
  assert.deepEqual(await at(0), ['visit:0']);
  assert.deepEqual(await at(2), []);
  assert.deepEqual(await at(-1), []);
  await q`UPDATE push_prefs SET next_visit_on = NULL WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A), []);
  // godzina ogólna (notify_hour) obowiązuje w trybie godzinowym; w dziennym idzie od razu
  await at(1);
  await q`UPDATE push_prefs SET notify_hour = 10 WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 9 }), []);
  assert.deepEqual(await keys(A, { respectHour: true, hour: 10 }), ['visit:1']);
  assert.deepEqual(await keys(A, { respectHour: false, hour: 3 }), ['visit:1']);
  // wyłączony przełącznik wycisza mimo daty
  await q`UPDATE push_prefs SET notify_visit = FALSE WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A), []);
});

test('objawy o własnej godzinie nie zależą od ogólnej godziny przypomnień', { skip }, async () => {
  const A = ids.ania;
  await q`UPDATE push_prefs SET notify_symptoms = TRUE, symptoms_hour = 19, notify_hour = 22 WHERE user_id = ${A}`;
  assert.deepEqual(await keys(A, { respectHour: true, hour: 19 }), ['symptoms']);
});

test('cron: deduplikacja, brak wysyłki po wpisie, treść dyskretna, limit i brak kluczy', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  await q`UPDATE push_prefs SET notify_symptoms = TRUE, symptoms_hour = 21 WHERE user_id = ${A}`;
  const send = mockSender();

  const r1 = await push.sendReminders({ send, respectHour: true, hour: 21 });
  assert.deepEqual(r1, { users: 1, notifications: 1, delivered: 1, failed: 0, removed: 0 });
  assert.equal(send.sent.length, 1);
  assert.deepEqual(send.sent[0].payload, { title: 'Zielnik', url: '/#objawy', tag: 'zielnik-przypomnienia', body: 'Masz wpis do uzupełnienia.' });
  // to samo wywołanie ponownie i kolejna godzina okna: bez powtórki (klucz: użytkownik + rodzaj + dzień)
  assert.equal((await push.sendReminders({ send, respectHour: true, hour: 21 })).users, 0);
  assert.equal((await push.sendReminders({ send, respectHour: true, hour: 22 })).users, 0);
  assert.equal(send.sent.length, 1);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_sent WHERE user_id = ${A} AND key = 'symptoms'`)[0].n, 1);

  // wizyta i objawy razem: jedno zgrupowane powiadomienie; treść szczegółowa bez słów o konopiach
  await q`DELETE FROM push_sent`;
  await q`UPDATE push_prefs SET notify_visit = TRUE, next_visit_on = ${await day(1)}::date, show_details = TRUE WHERE user_id = ${A}`;
  send.sent.length = 0;
  assert.equal((await push.sendReminders({ send, respectHour: true, hour: 21 })).users, 1);
  assert.equal(send.sent.length, 1);
  assert.equal(send.sent[0].payload.body, 'Masz wpis do uzupełnienia.\nJutro masz wizytę.');
  assert.doesNotMatch(JSON.stringify(send.sent), /konop|cannab|susz|recept|odmian|medyczn|zapas/i);
  // bez szczegółów: sam licznik
  await q`DELETE FROM push_sent`;
  await q`UPDATE push_prefs SET show_details = FALSE WHERE user_id = ${A}`;
  send.sent.length = 0;
  await push.sendReminders({ send, respectHour: true, hour: 21 });
  assert.match(send.sent[0].payload.body, /^Masz 2 przypomnienia\./);

  // nieudana dostawa zwalnia rezerwację: próba ponowiona przy następnym przebiegu
  await q`DELETE FROM push_sent`;
  const failing = async () => { throw Object.assign(new Error('blad'), { statusCode: 500 }); };
  await push.sendReminders({ send: failing, respectHour: true, hour: 21 });
  assert.equal((await q`SELECT count(*)::int AS n FROM push_sent WHERE user_id = ${A}`)[0].n, 0);

  // wpis objawów przed przypomnieniem blokuje wysyłkę
  await q`UPDATE push_prefs SET notify_visit = FALSE WHERE user_id = ${A}`;
  await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${A}, ${await day()}::date, 3)`;
  assert.equal((await push.sendReminders({ send, respectHour: true, hour: 21 })).users, 0);

  // limit przebiegu: tylko N użytkowników, reszta w następnym
  await q`DELETE FROM symptom_log`;
  await q`UPDATE push_prefs SET notify_symptoms = TRUE WHERE user_id IN (${A}, ${B})`;
  assert.equal((await push.dueReminders({ respectHour: true, hour: 21, limit: 1 })).length, 1);
  assert.equal((await push.dueReminders({ respectHour: true, hour: 21 })).length, 2);

  // trasa crona w trybie dziennym (domyślnym): bez wieczornych przypomnień
  const auth = { headers: { authorization: 'Bearer sekret-crona' } };
  push.setPushSender(send);
  await q`DELETE FROM push_sent`;
  const daily = await call(null, 'cron/reminders', 'GET', null, auth);
  assert.equal(daily.status, 200);
  assert.equal(daily.json.users, 0);
  push.setPushSender(null);

  // brak kluczy push: cron nic nie wysyła i nie zgłasza błędu, a ustawienia dają się zapisać
  for (const k of Object.keys(VAPID)) delete process.env[k];
  try {
    const none = await call(null, 'cron/reminders', 'GET', null, auth);
    assert.equal(none.status, 200);
    assert.match(none.json.skipped, /VAPID/);
    const cfg = (await call(A, 'push/config', 'GET')).json;
    assert.equal(cfg.any, false);
    assert.equal((await call(A, 'push/prefs', 'PUT', { notifySymptoms: true })).status, 200);
  } finally { Object.assign(process.env, VAPID); }
});
