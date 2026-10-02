// Testy kopii zapasowej: pełny zrzut tabel, zapis do tabeli albo (wstrzykiwany, zamockowany) Vercel Blob, retencja.
// Uruchom: TEST_DATABASE_URL=postgres://z:z@localhost/zielnik_bak npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, backup, pack, jar, createSession;

// Atrapa klienta Blob: trzyma pliki w pamięci
function fakeBlob(initial = []) {
  const files = new Map(initial.map((f) => [f.pathname, f]));
  const calls = { put: [], del: [] };
  return {
    files, calls,
    put: async (path, body, opts) => { calls.put.push({ path, opts }); files.set(path, { pathname: path, body, uploadedAt: new Date() }); return { pathname: path }; },
    list: async ({ prefix }) => ({ blobs: [...files.values()].filter((f) => f.pathname.startsWith(prefix)), hasMore: false }),
    del: async (paths) => { calls.del.push(paths); for (const p of [].concat(paths)) files.delete(p); },
  };
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
  backup = await import('../../lib/backup.js');
  pack = await import('../../lib/backup-pack.js');
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO users (username, password_hash, avatar) VALUES ('ania', 'tajny-hash', 'data:image/png;base64,AAA')`;
  await q`INSERT INTO strains (name, producer, type) VALUES ('Testowa', 'Aurora', 'haze')`;
});

after(async () => { if (pool) await pool.end(); });

test('buildBackup obejmuje wszystkie tabele z treścią (także nowe), bez wykluczonych i wrażliwych kolumn', { skip }, async () => {
  await q`CREATE TABLE IF NOT EXISTS zz_nowa_tabela (id SERIAL PRIMARY KEY, note TEXT)`;
  await q`INSERT INTO zz_nowa_tabela (note) VALUES ('widoczna w kopii')`;
  const b = await backup.buildBackup();
  assert.deepEqual(b.zz_nowa_tabela.map((r) => r.note), ['widoczna w kopii']);
  for (const t of ['users', 'strains', 'user_strain', 'purchases', 'usage_log', 'prescriptions', 'symptom_log', 'invites', 'reports', 'audit_log']) {
    assert.ok(Array.isArray(b[t]), `brak tabeli ${t}`);
  }
  for (const t of backup.BACKUP_EXCLUDED) assert.equal(t in b, false, `${t} nie powinno być w kopii`);
  const u = b.users.find((x) => x.username === 'ania');
  assert.ok(u);
  assert.equal('password_hash' in u, false);
  assert.equal('avatar' in u, false);
  assert.equal(b.strains.length, 1);
});

test('bez BLOB_READ_WRITE_TOKEN: zapis do tabeli backups (8 najnowszych), blob_path pusty', { skip }, async () => {
  await q`DELETE FROM backups`;
  for (let i = 0; i < 10; i++) await backup.saveSnapshot('auto', { env: {} });
  const rows = await q`SELECT kind, size, data, blob_path FROM backups`;
  assert.equal(rows.length, 8);
  assert.ok(rows.every((r) => r.blob_path === null && JSON.parse(r.data).users));
});

test('z tokenem: plik prywatny w Blob (gzip), w tabeli tylko metadane', { skip }, async () => {
  await q`DELETE FROM backups`;
  const blob = fakeBlob();
  const size = await backup.saveSnapshot('ręczna', { env: { BLOB_READ_WRITE_TOKEN: 'tok' }, blob });
  assert.equal(blob.calls.put.length, 1);
  const { path, opts } = blob.calls.put[0];
  assert.equal(opts.access, 'private');
  assert.equal(opts.token, 'tok');
  assert.match(path, /^zielnik-backups\/.*-reczna\.json\.gz$/);
  const stored = blob.files.get(path).body;
  assert.equal(size, stored.length);
  assert.ok(JSON.parse(pack.unpackBackup(stored)).users.some((u) => u.username === 'ania'));
  const [row] = await q`SELECT kind, size, data, blob_path FROM backups`;
  assert.deepEqual({ ...row }, { kind: 'ręczna', size: stored.length, data: '', blob_path: path });
});

test('z tokenem i BACKUP_ENCRYPTION_KEY: plik .enc, bez jawnego tekstu, odszyfrowuje się kluczem', { skip }, async () => {
  await q`DELETE FROM backups`;
  const blob = fakeBlob();
  const key = randomBytes(32).toString('base64');
  await backup.saveSnapshot('auto', { env: { BLOB_READ_WRITE_TOKEN: 'tok', BACKUP_ENCRYPTION_KEY: key }, blob });
  const { path } = blob.calls.put[0];
  assert.match(path, /-auto\.json\.gz\.enc$/);
  const stored = blob.files.get(path).body;
  assert.equal(stored.indexOf('ania'), -1);
  assert.ok(JSON.parse(pack.unpackBackup(stored, key)).users);
  assert.throws(() => pack.unpackBackup(stored, randomBytes(32).toString('base64')));
  await assert.rejects(backup.saveSnapshot('auto', { env: { BLOB_READ_WRITE_TOKEN: 'tok', BACKUP_ENCRYPTION_KEY: 'zly' }, blob }), /32 bajty/);
});

test('retencja: z Blob znikają kopie starsze niż 12 tygodni (i ich metadane), młodsze zostają', { skip }, async () => {
  await q`DELETE FROM backups`;
  const day = 86400000;
  const old = { pathname: 'zielnik-backups/stara.json.gz', uploadedAt: new Date(Date.now() - 100 * day) };
  const fresh = { pathname: 'zielnik-backups/swieza.json.gz', uploadedAt: new Date(Date.now() - 10 * day) };
  const foreign = { pathname: 'inne/stary-plik', uploadedAt: new Date(Date.now() - 400 * day) };
  const blob = fakeBlob([old, fresh, foreign]);
  await q`INSERT INTO backups (kind, size, data, blob_path, created_at) VALUES ('auto', 1, '', ${old.pathname}, now() - interval '100 days'), ('auto', 1, '', ${fresh.pathname}, now() - interval '10 days')`;
  await backup.saveSnapshot('auto', { env: { BLOB_READ_WRITE_TOKEN: 'tok' }, blob });
  assert.deepEqual(blob.calls.del, [[old.pathname]]);
  assert.equal(blob.files.has(old.pathname), false);
  assert.equal(blob.files.has(fresh.pathname), true);
  assert.equal(blob.files.has(foreign.pathname), true);
  const paths = (await q`SELECT blob_path FROM backups`).map((r) => r.blob_path);
  assert.equal(paths.length, 2);
  assert.ok(paths.includes(fresh.pathname) && !paths.includes(old.pathname));
});

test('retencja w tabeli (bez Blob) nie rusza metadanych kopii z Blob', { skip }, async () => {
  await q`DELETE FROM backups`;
  await q`INSERT INTO backups (kind, size, data, blob_path) VALUES ('auto', 1, '', 'zielnik-backups/x.json.gz')`;
  for (let i = 0; i < 9; i++) await backup.saveSnapshot('auto', { env: {} });
  const rows = await q`SELECT blob_path FROM backups`;
  assert.equal(rows.length, 9);
  assert.equal(rows.filter((r) => r.blob_path).length, 1);
});

test('panel admina: lista oznacza kopie z Blob, trasa pobierania wymaga admina', { skip }, async () => {
  await q`DELETE FROM backups`;
  await q`INSERT INTO backups (kind, size, data, blob_path) VALUES ('auto', 5, '', 'zielnik-backups/a.json.gz.enc')`;
  await q`UPDATE users SET must_change_password = false`;
  const [admin] = await q`SELECT id FROM users WHERE is_admin LIMIT 1`;
  const [ania] = await q`SELECT id FROM users WHERE username = 'ania'`;
  const callRoute = async (uid, route, url) => {
    jar.clear();
    await createSession(uid);
    const mod = await import(`../../app/api/${route}/route.js`);
    return mod.GET(new Request(url));
  };
  const ok = await callRoute(admin.id, 'admin/backups', 'http://localhost/api/admin/backups');
  const { backups } = await ok.json();
  assert.equal(backups[0].blob, true);
  assert.equal(backups[0].encrypted, true);
  const [b] = await q`SELECT id FROM backups`;
  assert.equal((await callRoute(ania.id, 'backup', `http://localhost/api/backup?id=${b.id}`)).status, 403);
});
