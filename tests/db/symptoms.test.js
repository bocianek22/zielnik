// Dziennik objawów: dzisiejszy wpis dla panelu „Dziś” (lib/stats.js todaySymptoms) i szybki zapis przez PUT /api/symptoms.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, stats, today;
const ids = {};

async function call(uid, method, body) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import('../../app/api/symptoms/route.js');
  const req = new Request('http://localhost/api/symptoms', {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve({}) });
  return { status: res.status, json: await res.json() };
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
  stats = await import('../../lib/stats.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  [{ today }] = await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS today`;
});

after(async () => { if (pool) await pool.end(); });

test('todaySymptoms: tylko dzisiejszy (czas polski) i tylko własny wpis', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  assert.equal(await stats.todaySymptoms(A), null);
  await q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note) VALUES
    (${A}, (now() AT TIME ZONE 'Europe/Warsaw')::date - 1, 9, 9, 9, 9, 'wczoraj'),
    (${B}, (now() AT TIME ZONE 'Europe/Warsaw')::date, 1, 1, 1, 1, 'cudzy')`;
  assert.equal(await stats.todaySymptoms(A), null);
  await q`INSERT INTO symptom_log (user_id, day, pain, note) VALUES (${A}, (now() AT TIME ZONE 'Europe/Warsaw')::date, 3, 'po spacerze')`;
  assert.deepEqual({ ...(await stats.todaySymptoms(A)) }, { pain: 3, sleep: null, anxiety: null, mood: null, note: 'po spacerze' });
});

test('szybki wpis: zapis częściowy (null) i zachowanie notatki przy kolejnych dotknięciach', { skip }, async () => {
  const A = ids.ania;
  const cur = { ...(await stats.todaySymptoms(A)) };
  // panel wysyła cały wiersz z dotychczasową notatką, zmienia jeden wymiar
  let r = await call(A, 'PUT', { day: today, ...cur, sleep: 7 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  let row = r.json.rows.find((x) => x.day === today);
  assert.deepEqual([row.pain, row.sleep, row.anxiety, row.mood, row.note], [3, 7, null, null, 'po spacerze']);
  // wyczyszczenie wymiaru (ponowne dotknięcie) = null, nie 0
  r = await call(A, 'PUT', { day: today, ...cur, sleep: 7, pain: null });
  row = r.json.rows.find((x) => x.day === today);
  assert.deepEqual([row.pain, row.sleep, row.note], [null, 7, 'po spacerze']);
  // bez notatki w żądaniu trasa ją czyści: dlatego panel musi ją odsyłać
  r = await call(A, 'PUT', { day: today, pain: 5, sleep: 7, anxiety: 0, mood: 10 });
  row = r.json.rows.find((x) => x.day === today);
  assert.deepEqual([row.pain, row.sleep, row.anxiety, row.mood, row.note], [5, 7, 0, 10, '']);
  // cudzy wpis bez zmian
  const [b] = await q`SELECT pain, note FROM symptom_log WHERE user_id = ${ids.bartek}`;
  assert.deepEqual({ ...b }, { pain: 1, note: 'cudzy' });
  // wartości spoza 0–10 odrzucone
  assert.equal((await call(A, 'PUT', { day: today, pain: 11 })).status, 400);
  assert.equal((await call(null, 'PUT', { day: today, pain: 1 })).status, 401);
});
