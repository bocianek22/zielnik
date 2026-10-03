// „Moje obserwacje” (lib/observations.js, POM-06): progi, sen z poprzedniego dnia, czas polski, jednostki, tylko własne dane.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, observations;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
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
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  ({ observations } = await import('../../lib/observations.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek', 'celina', 'darek', 'ewa', 'filip']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

const create = async (uid, name, form = 'susz') => {
  const id = (await call(uid, 'strains', 'POST', { name, producer: 'Aurora', type: 'haze' })).json.id;
  await q`UPDATE strains SET form = ${form} WHERE id = ${id}`;
  return id;
};
// zużycie `ago` dni temu o podanej godzinie czasu polskiego (odporne na zmianę czasu)
const use = (uid, sid, ago, grams = 0.5, at = '12:00') => q`INSERT INTO usage_log (user_id, strain_id, grams, created_at)
  VALUES (${uid}, ${sid}, ${grams}, (((now() AT TIME ZONE 'Europe/Warsaw')::date - ${ago}::int) + ${at}::time) AT TIME ZONE 'Europe/Warsaw')`;
const sym = (uid, ago, v) => q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood)
  VALUES (${uid}, (now() AT TIME ZONE 'Europe/Warsaw')::date - ${ago}::int, ${v.pain ?? null}, ${v.sleep ?? null}, ${v.anxiety ?? null}, ${v.mood ?? null})`;
const row = (o, key, sid) => o.symptoms[key].strains.find((s) => s.id === sid);

test('brak danych: puste grupy, bez średnich', { skip }, async () => {
  const o = await observations(ids.ania);
  assert.equal(o.period, 90);
  assert.equal(o.entries, 0);
  assert.equal(o.firstUse, null);
  for (const k of ['pain', 'sleep', 'anxiety', 'mood']) {
    assert.deepEqual(o.symptoms[k].strains, []);
    assert.deepEqual(o.symptoms[k].none, { days: 0, avg: null });
  }
});

test('próg 5 dni: przy 4 dniach tylko liczba dni, od 5 średnia; dni sprzed pierwszego zużycia nie są „bez zużycia”', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, 'Prog');
  await use(A, s, 20); // pierwsze zużycie
  for (const [ago, pain] of [[1, 2], [2, 4], [3, 2], [4, 4]]) { await use(A, s, ago); await sym(A, ago, { pain }); }
  let o = await observations(A);
  assert.deepEqual(row(o, 'pain', s), { id: s, name: 'Prog', unit: 'g', days: 4, avg: null });

  await use(A, s, 5); await sym(A, 5, { pain: 3 });
  // bez zużycia: 10–14 dni temu; 25–27 dni temu jest przed pierwszym zużyciem i się nie liczy
  for (const ago of [10, 11, 12, 13, 14]) await sym(A, ago, { pain: 6 });
  for (const ago of [25, 26, 27]) await sym(A, ago, { pain: 9 });
  o = await observations(A);
  assert.deepEqual(row(o, 'pain', s), { id: s, name: 'Prog', unit: 'g', days: 5, avg: 3 });
  assert.deepEqual(o.symptoms.pain.none, { days: 5, avg: 6 });
  assert.equal(o.symptoms.pain.days, 10);
  // sen nie był wpisywany: brak grup
  assert.deepEqual(o.symptoms.sleep.strains, []);
  assert.equal(o.entries, 13);

  // okres 30 dni obejmuje to samo; nieznany okres = 90
  assert.equal((await observations(A, 7)).period, 90);
  assert.equal((await observations(A, 30)).symptoms.pain.none.days, 5);
});

test('sen porównywany z zużyciem z poprzedniego dnia, pozostałe objawy z tym samym dniem', { skip }, async () => {
  const B = ids.bartek;
  const a = await create(B, 'Dzienna');
  const b = await create(B, 'Wieczorna');
  // Dzienna w dniach parzystych (2..10 dni temu), Wieczorna dzień wcześniej (3..11); wpis objawów w dniach Dziennej
  for (const d of [2, 4, 6, 8, 10]) { await use(B, a, d); await use(B, b, d + 1); await sym(B, d, { pain: 2, sleep: 8 }); }
  const o = await observations(B);
  assert.deepEqual(row(o, 'pain', a), { id: a, name: 'Dzienna', unit: 'g', days: 5, avg: 2 });
  assert.equal(row(o, 'pain', b), undefined);
  assert.deepEqual(row(o, 'sleep', b), { id: b, name: 'Wieczorna', unit: 'g', days: 5, avg: 8 });
  assert.equal(row(o, 'sleep', a), undefined);
  assert.equal(o.symptoms.sleep.mixed.days, 0);
});

test('dzień w czasie polskim: 00:30 w Polsce (w UTC jeszcze wczoraj) to ten sam dzień, 23:30 to poprzedni', { skip }, async () => {
  const C = ids.celina;
  const p = await create(C, 'Polnoc');
  const w = await create(C, 'Wieczor');
  await use(C, p, 40);
  for (const d of [2, 4, 6, 8, 10]) { await use(C, p, d, 0.5, '00:30'); await sym(C, d, { pain: 5 }); }
  // Wieczor o 23:30 dzień przed wpisem: ból z dnia wpisu to „bez zużycia”, sen z dnia wpisu to Wieczor
  for (const d of [13, 15, 17, 19, 21]) { await use(C, w, d + 1, 0.5, '23:30'); await sym(C, d, { pain: 7, sleep: 4 }); }
  const o = await observations(C);
  assert.deepEqual(row(o, 'pain', p), { id: p, name: 'Polnoc', unit: 'g', days: 5, avg: 5 });
  assert.equal(row(o, 'pain', w), undefined);
  assert.deepEqual(o.symptoms.pain.none, { days: 5, avg: 7 });
  assert.deepEqual(row(o, 'sleep', w), { id: w, name: 'Wieczor', unit: 'g', days: 5, avg: 4 });
});

test('dni z kilkoma odmianami osobno; susz w g, olej w ml, bez sumowania jednostek', { skip }, async () => {
  const D = ids.darek;
  const s = await create(D, 'Susz D');
  const o1 = await create(D, 'Olej D', 'olej');
  for (const d of [1, 2, 3, 4, 5]) { await use(D, s, d, 0.5); await use(D, o1, d, 0.2, '20:00'); await sym(D, d, { mood: 6 }); }
  for (const d of [6, 7, 8, 9, 10]) { await use(D, o1, d, 0.3); await sym(D, d, { mood: 4 }); }
  const o = await observations(D);
  assert.deepEqual(o.symptoms.mood.mixed, { days: 5, avg: 6 });
  assert.deepEqual(row(o, 'mood', o1), { id: o1, name: 'Olej D', unit: 'ml', days: 5, avg: 4 });
  assert.equal(row(o, 'mood', s), undefined);
  const byId = Object.fromEntries(o.strains.map((x) => [x.id, x]));
  assert.deepEqual(byId[s], { id: s, name: 'Susz D', unit: 'g', total: 2.5, useDays: 5 });
  assert.deepEqual(byId[o1], { id: o1, name: 'Olej D', unit: 'ml', total: 2.5, useDays: 10 });
  assert.deepEqual(o.mixed, { days: 5, g: 2.5, ml: 1 });
});

test('tylko własne dane: cudze zużycie tej samej odmiany i cudze objawy nic nie zmieniają', { skip }, async () => {
  const { ewa: E, ania: A } = ids;
  const t = await create(E, 'Wspolna');
  const other = await create(A, 'Cudza');
  await use(E, t, 20);
  for (const d of [1, 2, 3, 4, 5]) { await use(E, t, d); await sym(E, d, { anxiety: 5 }); }
  for (const d of [6, 7, 8, 9, 10]) { await sym(E, d, { anxiety: 3 }); await use(A, t, d); await use(A, other, d); }
  // cudze wpisy w dniach Ewy
  for (const d of [1, 2, 3]) await use(A, other, d);
  const o = await observations(E);
  assert.deepEqual(row(o, 'anxiety', t), { id: t, name: 'Wspolna', unit: 'g', days: 5, avg: 5 });
  assert.deepEqual(o.symptoms.anxiety.none, { days: 5, avg: 3 });
  assert.deepEqual(o.symptoms.anxiety.mixed, { days: 0, avg: null });
  assert.deepEqual(o.strains.map((x) => x.id), [t]);
  assert.equal(o.mixed.days, 0);
  assert.equal(o.entries, 10);
});

test('okres 30 dni: zużycie z dnia przed okresem liczy się do snu z pierwszego dnia, ale nie do sum zużycia', { skip }, async () => {
  const F = ids.filip;
  const w = await create(F, 'Przed oknem');
  await use(F, w, 30, 1); // dzień przed 30-dniowym okresem (dziś = 0, okres to 0..29 dni temu)
  await sym(F, 29, { sleep: 6 });
  const o = await observations(F, 30);
  assert.deepEqual(row(o, 'sleep', w), { id: w, name: 'Przed oknem', unit: 'g', days: 1, avg: null });
  assert.deepEqual(o.strains, []);
  assert.equal(o.mixed.days, 0);
  // w okresie 90 dni ta sama ilość jest już w sumach
  assert.deepEqual((await observations(F, 90)).strains, [{ id: w, name: 'Przed oknem', unit: 'g', total: 1, useDays: 1 }]);
});
