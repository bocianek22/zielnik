// POM-08 seria wpisów objawów (lib/streak.js) i POM-18 wycinek obserwacji dla odmiany (strainView w lib/observations.js).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, symptomStreak, observations, strainView;
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
  ({ symptomStreak } = await import('../../lib/streak.js'));
  ({ observations, strainView } = await import('../../lib/observations.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek', 'celina']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

const sym = (uid, day, v) => q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note)
  VALUES (${uid}, ${day}::date, ${v.pain ?? null}, ${v.sleep ?? null}, ${v.anxiety ?? null}, ${v.mood ?? null}, ${v.note ?? ''})`;
const symAgo = (uid, ago, v) => q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${uid}, (now() AT TIME ZONE 'Europe/Warsaw')::date - ${ago}::int, ${v})`;
const use = (uid, sid, ago) => q`INSERT INTO usage_log (user_id, strain_id, grams, created_at)
  VALUES (${uid}, ${sid}, 0.5, (((now() AT TIME ZONE 'Europe/Warsaw')::date - ${ago}::int) + '12:00'::time) AT TIME ZONE 'Europe/Warsaw')`;

test('seria: kolejne dni, dzień polski, sama notatka się nie liczy, własny objaw się liczy', { skip }, async () => {
  const A = ids.ania;
  // 22:30 UTC 9.10 to już 10.10 w Warszawie (CEST)
  const now = new Date('2026-10-09T22:30:00Z');
  let s = await symptomStreak(A, now);
  assert.equal(s.streak, 0);
  assert.equal(s.weekCount, 0);
  assert.equal(s.week.at(-1).day, '2026-10-10');

  await sym(A, '2026-10-09', { pain: 3 });
  await sym(A, '2026-10-08', { mood: 6 });
  await sym(A, '2026-10-07', { note: 'tylko notatka' });
  s = await symptomStreak(A, now);
  assert.equal(s.streak, 2, 'brak wpisu dziś nie zeruje serii, notatka bez wartości przerywa');
  assert.equal(s.weekCount, 2);

  const [c] = await q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${A}, 1, 'Apetyt') RETURNING id`;
  await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${c.id}, ${A}, '2026-10-07', 4), (${c.id}, ${A}, '2026-10-10', 5)`;
  s = await symptomStreak(A, now);
  assert.equal(s.streak, 4);
  assert.deepEqual(s.week.map((d) => d.on), [false, false, false, true, true, true, true]);

  // ta sama chwila tuż przed północą polską: „dziś” to 9.10
  s = await symptomStreak(A, new Date('2026-10-09T21:30:00Z'));
  assert.equal(s.week.at(-1).day, '2026-10-09');
  assert.equal(s.streak, 3);
});

test('seria: tylko własne wpisy', { skip }, async () => {
  const now = new Date('2026-10-09T22:30:00Z');
  const s = await symptomStreak(ids.bartek, now);
  assert.equal(s.streak, 0);
  assert.equal(s.weekCount, 0);
});

test('samopoczucie po odmianie: tylko dni z samą tą odmianą, próg dni, porównanie z dniami bez zużycia', { skip }, async () => {
  const C = ids.celina;
  const mk = async (name) => (await call(C, 'strains', 'POST', { name, producer: 'Aurora', type: 'haze' })).json.id;
  const [a, b, c] = [await mk('Feel A'), await mk('Feel B'), await mk('Feel C')];
  await use(C, a, 30); // pierwsze zużycie: od niego dni bez wpisu zużycia są „bez zużycia”
  for (let ago = 1; ago <= 6; ago++) { await use(C, a, ago); await symAgo(C, ago, 2); }
  await use(C, a, 7); await use(C, b, 7); await symAgo(C, 7, 9); // dzień mieszany: poza zestawieniem
  for (let ago = 8; ago <= 11; ago++) await symAgo(C, ago, 6); // 4 dni bez zużycia: poniżej progu

  let v = strainView(await observations(C), a);
  assert.equal(v.useDays, 8);
  const pain = v.rows.find((r) => r.key === 'pain');
  assert.deepEqual([pain.with.days, pain.with.avg], [6, 2]);
  assert.deepEqual(pain.without, { days: 4, avg: null }, 'poniżej progu sama liczba dni');
  assert.equal(v.enough, false);

  await symAgo(C, 12, 6);
  v = strainView(await observations(C), a);
  assert.deepEqual(v.rows.find((r) => r.key === 'pain').without, { days: 5, avg: 6 });
  assert.equal(v.enough, true);

  const vb = strainView(await observations(C), b);
  assert.equal(vb.useDays, 1);
  assert.deepEqual(vb.rows, [], 'B tylko w dniu mieszanym');
  const vc = strainView(await observations(C), c);
  assert.equal(vc.useDays, 0);

  // cudze dane nie wpływają na wynik
  const vo = strainView(await observations(ids.bartek), a);
  assert.equal(vo.useDays, 0);
  assert.deepEqual(vo.rows, []);
});
