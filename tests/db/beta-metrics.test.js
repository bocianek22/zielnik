// Beta D6: zbiorcze wskaźniki bety w panelu admina: poprawne liczby, ukrywanie grup < 5 kont po stronie serwera, bez danych osób.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, jar, createSession, adminId, strainId;

const stats = async (uid) => {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import('../../app/api/admin/stats/route.js');
  const res = await mod.GET(new Request('http://localhost/api/admin/stats'));
  return { status: res.status, json: await res.json() };
};
// konto zarejestrowane `days` dni temu
const mk = async (name, days = 10) => (await q`INSERT INTO users (username, password_hash, must_change_password, created_at)
  VALUES (${name}, 'x', FALSE, now() - make_interval(days => ${days}::int)) RETURNING id, created_at`)[0];

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
  await db.ensureDb();
  q = db.sql();
  adminId = (await q`UPDATE users SET must_change_password = FALSE WHERE lower(username) = 'bocian' RETURNING id`)[0].id;
  strainId = (await q`INSERT INTO strains (producer, name, type) VALUES ('P', 'Wspólna', 'haze') RETURNING id`)[0].id;
});

after(async () => { if (pool) await pool.end(); });

test('wskaźniki bety: tylko dla admina', { skip }, async () => {
  assert.equal((await stats(null)).status, 401);
  const u = await mk('zwykly', 1);
  assert.equal((await stats(u.id)).status, 403);
  await q`DELETE FROM users WHERE id = ${u.id}`;
});

test('wskaźniki bety: grupa mniejsza niż 5 kont jest ukryta (null), konto admina się nie liczy', { skip }, async () => {
  for (let i = 0; i < 4; i++) {
    const u = await mk(`maly${i}`);
    await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${u.id}, ${strainId}, 1, ${u.created_at})`;
    await createSession(u.id);
  }
  // admin ma sesję i dane, ale nie wlicza się do grupy (inaczej 4 + admin = 5 odsłoniłoby liczby)
  await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${adminId}, ${strainId}, 1)`;
  const { status, json } = await stats(adminId);
  assert.equal(status, 200);
  assert.deepEqual(json.beta, { minGroup: 5, active7: null, cohort: null, pctStrain: null, pctPrescription: null, pctUsage: null });
});

test('wskaźniki bety: odsetki z pierwszych 7 dni od rejestracji i aktywne konta, grupa >= 5', { skip }, async () => {
  await q`DELETE FROM users WHERE username LIKE 'maly%'`;
  const U = [];
  for (let i = 0; i < 8; i++) U.push(await mk(`beta${i}`, 10 + i));
  const day = (u, n) => new Date(new Date(u.created_at).getTime() + n * 864e5).toISOString();
  // odmiana w oknie: 0-3 (wpis osobisty u 0-2, własna odmiana u 3), 4 po oknie (dzień 9) nie liczy się
  for (const i of [0, 1, 2]) await q`INSERT INTO user_strain (strain_id, user_id, rating, updated_at) VALUES (${strainId}, ${U[i].id}, 7, ${day(U[i], 2)})`;
  await q`INSERT INTO strains (producer, name, type, created_by, created_at) VALUES ('P', 'Moja', 'haze', ${U[3].id}, ${day(U[3], 1)})`;
  await q`INSERT INTO user_strain (strain_id, user_id, rating, updated_at) VALUES (${strainId}, ${U[4].id}, 7, ${day(U[4], 9)})`;
  // recepta w oknie: 0, 1; po oknie: 5
  for (const i of [0, 1]) await q`INSERT INTO prescriptions (user_id, issued_on, grams, created_at) VALUES (${U[i].id}, current_date, 10, ${day(U[i], 1)})`;
  await q`INSERT INTO prescriptions (user_id, issued_on, grams, created_at) VALUES (${U[5].id}, current_date, 10, ${day(U[5], 8)})`;
  // zużycie w oknie: 0, 1, 2, 3 (4 z 8 = 50%)
  for (const i of [0, 1, 2, 3]) await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${U[i].id}, ${strainId}, 1, ${day(U[i], 3)})`;
  // aktywność: sesje 0, 1, 2 w ostatnich 7 dniach, 3 sprzed 8 dni, 4 unieważniona; admin (aktywny) nie liczy się
  for (const i of [0, 1, 2]) await q`INSERT INTO sessions (id, user_id, expires_at, last_used_at) VALUES (${`s-${i}-aaaaaaaaaaaaaaaaaaaaaa`}, ${U[i].id}, now() + interval '1 day', now() - interval '1 day')`;
  await q`INSERT INTO sessions (id, user_id, expires_at, last_used_at) VALUES ('s-3-aaaaaaaaaaaaaaaaaaaaaa', ${U[3].id}, now() + interval '1 day', now() - interval '8 days')`;
  await q`INSERT INTO sessions (id, user_id, expires_at, last_used_at, revoked_at) VALUES ('s-4-aaaaaaaaaaaaaaaaaaaaaa', ${U[4].id}, now() + interval '1 day', now(), now())`;
  await q`INSERT INTO sessions (id, user_id, expires_at) VALUES ('s-admin-aaaaaaaaaaaaaaaaaaa', ${adminId}, now() + interval '1 day')`;
  // konto z ostatnich dni: poza kohortą (nie ma jeszcze pełnego okna), ale w grupie „aktywne”
  const fresh = await mk('swiezy', 2);
  await q`INSERT INTO sessions (id, user_id, expires_at) VALUES ('s-fresh-aaaaaaaaaaaaaaaaaaa', ${fresh.id}, now() + interval '1 day')`;
  const { json } = await stats(adminId);
  assert.deepEqual(json.beta, { minGroup: 5, active7: 4, cohort: 8, pctStrain: 50, pctPrescription: 25, pctUsage: 50 });
  // odpowiedź zawiera tylko liczby zbiorcze: żadnych nazw kont ani identyfikatorów
  const text = JSON.stringify(json);
  for (const u of U) assert.ok(!text.includes(`beta${U.indexOf(u)}`));
  assert.deepEqual(Object.keys(json.beta).sort(), ['active7', 'cohort', 'minGroup', 'pctPrescription', 'pctStrain', 'pctUsage']);
});

test('wskaźniki bety: kohorta poniżej 5 ukrywa odsetki, choć aktywne konta (grupa >= 5) są pokazane', { skip }, async () => {
  await q`UPDATE users SET created_at = now() - interval '2 days' WHERE username LIKE 'beta%' AND username NOT IN ('beta0', 'beta1', 'beta2')`;
  const { json } = await stats(adminId);
  assert.equal(json.beta.cohort, null);
  assert.equal(json.beta.pctUsage, null);
  assert.equal(typeof json.beta.active7, 'number');
});
