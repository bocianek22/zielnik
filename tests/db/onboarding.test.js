// POM-19: kreator pierwszego uruchomienia - kto go widzi, zamknięcie na koncie (nie na urządzeniu), konta z danymi.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

test('has_data: zakup, zużycie, objawy, własny objaw, własna odmiana, dzień bez użycia i notatka zamykają kreator; admin go nie widzi', { skip }, async () => {
  const mk = async (n) => (await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', FALSE) RETURNING id`)[0].id;
  const [s] = await q`INSERT INTO strains (producer, name, type) VALUES ('Aurora', 'Pusta', 'haze') RETURNING id`;
  const cases = {
    zakup: (u) => q`INSERT INTO purchases (user_id, strain_id, strain_name, grams) VALUES (${u}, ${s.id}, 'Pusta', 1)`,
    zuzycie: (u) => q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${u}, ${s.id}, 0.2)`,
    objawy: (u) => q`INSERT INTO symptom_log (user_id, day) VALUES (${u}, CURRENT_DATE)`,
    wlasny: (u) => q`INSERT INTO symptom_custom (user_id, slot, name) VALUES (${u}, 1, 'Moj objaw')`,
    utworzona: (u) => q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Tilray', ${`Wlasna ${u}`}, 'haze', ${u})`,
    bez_uzycia: (u) => q`INSERT INTO no_use_days (user_id, day) VALUES (${u}, CURRENT_DATE)`,
    notatka: (u) => q`INSERT INTO doctor_notes (user_id, text) VALUES (${u}, 'zapytac')`,
  };
  for (const [name, add] of Object.entries(cases)) {
    const u = await mk(`hd_${name}`);
    assert.equal(await onb.onboardingOpen(u), true, name);
    await add(u);
    assert.equal(await onb.onboardingOpen(u), false, name);
  }
  const [adm] = await q`INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES ('hd_admin', 'x', TRUE, FALSE) RETURNING id`;
  assert.equal(await onb.onboardingOpen(adm.id), false);
});

test('ensureDb zamyka kreator na kontach sprzed wdrożenia (created_at < 2026-10-08 14:00 UTC), nowszych nie', { skip }, async () => {
  const [old] = await q`INSERT INTO users (username, password_hash, must_change_password, created_at) VALUES ('sprzed', 'x', FALSE, '2026-10-01 10:00+00') RETURNING id`;
  const [fresh] = await q`INSERT INTO users (username, password_hash, must_change_password, created_at) VALUES ('po', 'x', FALSE, '2026-10-08 15:00+00') RETURNING id`;
  await q`DELETE FROM schema_meta`; // bez zapisanej sumy migracja nie jest pomijana (zimny start po wdrożeniu nowego SQL)
  // zimny start w osobnym procesie (nowa instancja modułu db)
  const root = new URL('../../', import.meta.url);
  const code = `const db = await import(${JSON.stringify(new URL('lib/db.js', root).href)}); await db.ensureDb(); process.exit(0);`;
  execFileSync(process.execPath, ['--experimental-default-type=module', '--import', fileURLToPath(new URL('register.mjs', import.meta.url)), '--input-type=module', '-e', code],
    { env: { ...process.env, DATABASE_URL: URL_ }, stdio: 'pipe' });
  const [a] = await q`SELECT onboarded_at FROM users WHERE id = ${old.id}`;
  const [b] = await q`SELECT onboarded_at FROM users WHERE id = ${fresh.id}`;
  assert.ok(a.onboarded_at);
  assert.equal(b.onboarded_at, null);
  assert.equal(await onb.onboardingOpen(old.id), false);
  assert.equal(await onb.onboardingOpen(fresh.id), true);
});
