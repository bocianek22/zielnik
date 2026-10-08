// Beta D3: odtwarzanie kopii zapasowej (scripts/dev/restore-drill.mjs): liczby wierszy, treść, liczniki id, hasła.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, buildBackup, restoreBackup, countRows, ids;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  await db.ensureDb();
  q = db.sql();
  ({ buildBackup } = await import('../../lib/backup.js'));
  ({ restoreBackup, countRows } = await import('../../scripts/dev/restore-drill.mjs'));
  const { populate } = await import('./populate.mjs');
  const mk = async (n) => (await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'haslo-hash', FALSE) RETURNING id`)[0].id;
  const [admin] = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  ids = { ania: await mk('ania'), bartek: await mk('bartek'), admin: admin.id };
  await populate(q, { v: ids.ania, o: ids.bartek, a: ids.admin });
  await populate(q, { v: ids.bartek, o: ids.ania, a: ids.admin });
});

after(async () => { if (pool) await pool.end(); });

test('odtworzenie: po utracie danych liczby wierszy, treść i liczniki id wracają', { skip }, async () => {
  const backup = await buildBackup();
  const tables = Object.keys(backup).filter((k) => k !== 'createdAt');
  const before = await countRows(pool, tables);
  assert.ok(tables.includes('users') && tables.includes('doctor_notes') && tables.includes('strain_proposals'));
  for (const t of ['user_strain', 'purchases', 'usage_log', 'reports', 'doctor_notes']) assert.ok(before[t] >= 2, `${t}: dane testowe`);
  assert.ok(before.friendships >= 1);
  // awaria: znikają konta (kaskadowo prawie wszystko) i odmiany
  await q`DELETE FROM users WHERE username IN ('ania', 'bartek')`;
  await q`DELETE FROM strains`;
  assert.equal((await countRows(pool, ['doctor_notes'])).doctor_notes, 0);
  const counts = await restoreBackup(pool, backup);
  assert.deepEqual(await countRows(pool, tables), before);
  for (const t of tables) assert.equal(counts[t], before[t], t);
  // treść i identyfikatory zachowane
  const [u] = await q`SELECT id FROM users WHERE username = 'ania'`;
  assert.equal(u.id, ids.ania);
  assert.equal((await q`SELECT text FROM doctor_notes WHERE user_id = ${ids.ania}`)[0].text, 'zapytać o dawkę');
  // liczniki SERIAL ruszają za największym id: nowy wiersz się nie zderza
  const [nu] = await q`INSERT INTO users (username, password_hash) VALUES ('nowy', 'x') RETURNING id`;
  assert.ok(nu.id > Math.max(ids.ania, ids.bartek, ids.admin));
  await q`DELETE FROM users WHERE id = ${nu.id}`;
});

test('odtworzenie: hasła wycięte z kopii zostają nieużywalne (nie da się zalogować), pozostałe pola konta wracają', { skip }, async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const backup = await buildBackup();
  assert.ok(backup.users.every((r) => !('password_hash' in r) && !('avatar' in r)));
  await restoreBackup(pool, backup);
  await q`UPDATE users SET must_change_password = FALSE`;
  await restoreBackup(pool, backup);
  const rows = await q`SELECT username, password_hash, must_change_password FROM users WHERE username IN ('ania', 'bartek', 'Bocian')`;
  assert.equal(rows.length, 3);
  for (const r of rows) {
    assert.equal(r.must_change_password, true, 'wymuszona zmiana hasła: inaczej syncAdmin nie przywróci hasła startowego admina');
    assert.ok(r.password_hash.startsWith('$2'));
    assert.equal(await bcrypt.compare('haslo-hash', r.password_hash), false);
  }
});

test('odtworzenie: błąd w trakcie wycofuje całość (transakcja), nazwa tabeli jest walidowana', { skip }, async () => {
  const backup = await buildBackup();
  const before = await countRows(pool, ['users', 'doctor_notes']);
  const broken = { ...backup, doctor_notes: [{ id: 999, user_id: 424242, text: 'sierota' }] }; // brak konta = naruszenie klucza obcego
  await assert.rejects(restoreBackup(pool, broken));
  assert.deepEqual(await countRows(pool, ['users', 'doctor_notes']), before);
  await assert.rejects(restoreBackup(pool, { 'users"; DROP TABLE users; --': [] }), /Nieobsługiwana nazwa/);
});

test('skrypt restore-drill.mjs: kopia bazy źródłowej odtworzona do świeżej bazy, liczby się zgadzają', { skip }, async () => {
  const dbName = URL_.slice(URL_.lastIndexOf('/') + 1);
  if (!/^\w+$/.test(dbName)) return;
  const admin = `${URL_.slice(0, URL_.lastIndexOf('/'))}/postgres`;
  const dst = `${dbName}_restore`;
  const r = spawnSync(process.execPath, ['--experimental-default-type=module', fileURLToPath(new URL('../../scripts/dev/restore-drill.mjs', import.meta.url)), dbName, dst],
    { env: { ...process.env, PG_ADMIN_URL: admin }, encoding: 'utf8' });
  try {
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /OK: \d+ tabel, \d+ wierszy zgodnych/);
    assert.ok(!/ROZBIEŻNOŚĆ|BŁĄD/.test(r.stdout));
    assert.match(r.stdout, /OK  admin Bocian loguje się hasłem startowym/, 'po starcie aplikacji admin wraca hasłem BOCIAN_INITIAL_PASSWORD');
    assert.match(r.stdout, /users\s+źródło\s+3/);
  } finally {
    await pool.query(`DROP DATABASE IF EXISTS "${dst}" WITH (FORCE)`);
  }
});
