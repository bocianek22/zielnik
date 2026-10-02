// Szybki zimny start: ensureDb() pomija migracje, gdy suma kontrolna schematu w bazie zgadza się z kodem.
// Każdy "zimny start" to osobny proces Node (świeży stan modułu lib/db.js), jak nowa instancja funkcji Vercel.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PWD = 'startowe-haslo';
let pool, db, bcrypt;

// Zimny start w nowym procesie: zwraca liczbę zapytań wykonanych przez ensureDb()
function coldStart(env = {}) {
  const code = `
    const { stats, pool } = await import('./tests/db/neon-shim.mjs');
    const { ensureDb } = await import('./lib/db.js');
    try { await ensureDb(); console.log(JSON.stringify({ queries: stats.queries })); }
    finally { await pool.end(); }`;
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['--experimental-default-type=module', '--import', './tests/db/register.mjs', '--input-type=module', '-e', code],
      { cwd: ROOT, env: { ...process.env, DATABASE_URL: URL_, BOCIAN_INITIAL_PASSWORD: PWD, ...env } },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(JSON.parse(stdout.trim().split('\n').pop()).queries)));
  });
}

const meta = async () => (await pool.query(`SELECT value FROM schema_meta WHERE key = 'schema'`)).rows[0]?.value;
const admin = async () => (await pool.query(`SELECT id, password_hash, must_change_password FROM users WHERE lower(username) = 'bocian'`)).rows[0];

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.BOCIAN_INITIAL_PASSWORD = PWD;
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  db = await import('../../lib/db.js');
  bcrypt = (await import('bcryptjs')).default;
  await db.ensureDb();
});

after(async () => { if (pool) await pool.end(); });

test('pierwsza inicjalizacja zapisuje sumę kontrolną schematu', { skip }, async () => {
  assert.match(db.SCHEMA_HASH, /^[0-9a-f]{64}$/);
  assert.equal(await meta(), db.SCHEMA_HASH);
  assert.equal((await admin()).must_change_password, true);
});

test('kolejny zimny start przy zgodnej sumie wykonuje najwyżej 2 zapytania', { skip }, async () => {
  const n = await coldStart();
  assert.ok(n <= 2, `zapytań: ${n}`);
});

test('zmieniona suma wymusza pełną migrację i zapisuje bieżącą', { skip }, async () => {
  await pool.query(`UPDATE schema_meta SET value = 'stara' WHERE key = 'schema'`);
  // brakujący element schematu wraca dzięki pełnej migracji
  await pool.query('DROP TABLE usage_log');
  const n = await coldStart();
  assert.ok(n > 50, `zapytań: ${n}`);
  assert.equal(await meta(), db.SCHEMA_HASH);
  assert.equal((await pool.query(`SELECT to_regclass('public.usage_log') AS t`)).rows[0].t, 'usage_log');
  assert.ok((await coldStart()) <= 2);
});

test('hasło startowe admina nadal jest synchronizowane na szybkiej ścieżce', { skip }, async () => {
  assert.ok(await bcrypt.compare(PWD, (await admin()).password_hash));
  // nowe hasło w zmiennej, dopóki admin nie ustawił własnego, zastępuje stare
  const n = await coldStart({ BOCIAN_INITIAL_PASSWORD: 'nowe-haslo-123' });
  assert.ok(n <= 2, `zapytań: ${n}`);
  assert.ok(await bcrypt.compare('nowe-haslo-123', (await admin()).password_hash));
  // po ustawieniu własnego hasła zmienna już nic nie zmienia
  await pool.query(`UPDATE users SET must_change_password = FALSE WHERE lower(username) = 'bocian'`);
  const own = (await admin()).password_hash;
  assert.equal(await coldStart({ BOCIAN_INITIAL_PASSWORD: 'inne-haslo-456' }), 1);
  assert.equal((await admin()).password_hash, own);
  // konto admina usunięte ręcznie jest odtwarzane także na szybkiej ścieżce
  await pool.query(`DELETE FROM users WHERE lower(username) = 'bocian'`);
  await coldStart();
  const a = await admin();
  assert.equal(a.must_change_password, true);
  assert.ok(await bcrypt.compare(PWD, a.password_hash));
});

test('równoległe zimne starty kończą się sukcesem (pusta baza i zmieniona suma)', { skip }, async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  await Promise.all([coldStart(), coldStart(), coldStart()]);
  assert.equal(await meta(), db.SCHEMA_HASH);
  assert.equal((await pool.query(`SELECT count(*)::int AS n FROM users WHERE lower(username) = 'bocian'`)).rows[0].n, 1);
  await pool.query(`UPDATE schema_meta SET value = 'stara' WHERE key = 'schema'`);
  await Promise.all([coldStart(), coldStart(), coldStart()]);
  assert.equal(await meta(), db.SCHEMA_HASH);
});
