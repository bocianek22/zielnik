// POM-19: kreator pierwszego uruchomienia - kto go widzi, zamknięcie na koncie (nie na urządzeniu), konta z danymi.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, onb;
const ids = {};

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
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  onb = await import('../../lib/onboarding.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['nowa', 'stara', 'recepta', 'zamknieta', 'obca']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', FALSE) RETURNING id`;
    ids[n] = u.id;
  }
  const [s] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Lemon', 'haze', ${ids.stara}) RETURNING id`;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${s.id}, ${ids.stara}, 2)`;
  await q`INSERT INTO prescriptions (user_id, issued_on, grams) VALUES (${ids.recepta}, CURRENT_DATE, 10)`;
  await q`UPDATE users SET onboarded_at = now() WHERE id = ${ids.zamknieta}`;
});
after(async () => { if (pool) await pool.end(); });

test('nowe konto bez odmian i recept widzi kreator; konto z odmianą, z receptą i z zamkniętym kreatorem nie', { skip }, async () => {
  assert.equal(await onb.onboardingOpen(ids.nowa), true);
  assert.equal(await onb.onboardingOpen(ids.stara), false);
  assert.equal(await onb.onboardingOpen(ids.recepta), false);
  assert.equal(await onb.onboardingOpen(ids.zamknieta), false);
  assert.equal(await onb.onboardingOpen(0), false);
});

test('konto z danymi jest zamykane od razu: kreator nie wraca po usunięciu wpisów', { skip }, async () => {
  const [a] = await q`SELECT onboarded_at FROM users WHERE id = ${ids.stara}`;
  assert.ok(a.onboarded_at);
  await q`DELETE FROM user_strain WHERE user_id = ${ids.stara}`;
  assert.equal(await onb.onboardingOpen(ids.stara), false);
});

test('POST /api/onboarding zamyka kreator na koncie, jest idempotentny i nie dotyka cudzych kont', { skip }, async () => {
  assert.equal((await call(null, 'onboarding', 'POST')).status, 401);
  const r = await call(ids.nowa, 'onboarding', 'POST');
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { ok: true });
  assert.equal(await onb.onboardingOpen(ids.nowa), false);
  const [first] = await q`SELECT onboarded_at FROM users WHERE id = ${ids.nowa}`;
  assert.equal((await call(ids.nowa, 'onboarding', 'POST')).status, 200);
  const [second] = await q`SELECT onboarded_at FROM users WHERE id = ${ids.nowa}`;
  assert.equal(String(first.onboarded_at), String(second.onboarded_at));
  assert.equal(await onb.onboardingOpen(ids.obca), true); // inne konto nadal widzi kreator
});

test('kreator pozostaje zamknięty po dodaniu i usunięciu wpisów (stan na koncie)', { skip }, async () => {
  const [s] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Tilray', 'Bediol', 'haze', ${ids.nowa}) RETURNING id`;
  await q`INSERT INTO user_strain (strain_id, user_id) VALUES (${s.id}, ${ids.nowa})`;
  await q`DELETE FROM user_strain WHERE user_id = ${ids.nowa}`;
  assert.equal(await onb.onboardingOpen(ids.nowa), false);
});
