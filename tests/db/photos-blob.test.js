// Testy zdjęć w Vercel Blob (PLA-4): zapis, odczyt przez trasy z uprawnieniami, usuwanie, ścieżka bez tokenu (base64),
// eksport konta i skrypt migracji. Moduł @vercel/blob jest podmieniony na tests/db/blob-shim.mjs (obiekty w pamięci).
// Uruchom: TEST_DATABASE_URL=postgres://z:z@localhost/blobdb npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pngBytes } from './images.mjs';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, blob;
const ids = {};
const bytes = (s) => pngBytes(s); // poprawny PNG (trasy sprawdzają zawartość i czyszczą metadane)
const img = (s) => `data:image/png;base64,${bytes(s).toString('base64')}`;

// Wywołanie trasy jako zalogowany użytkownik; zwraca surową odpowiedź i (dla JSON) treść
async function call(uid, route, method, body, params = {}, query = '') {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}${query}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json, res };
}

const keys = () => [...blob.store.keys()];

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  process.env.PHOTOS_BLOB = '1';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  blob = await import('./blob-shim.mjs');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
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

test('zdjęcie odmiany: zapis do Blob (prywatnie, losowa ścieżka), odczyt przez trasę, podmiana i usunięcie', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const sid = (await call(A, 'strains', 'POST', { name: 'Tajna Nazwa', producer: 'Aurora', type: 'haze' })).json.id;
  const p = { id: String(sid) };
  assert.equal((await call(A, 'strains/[id]/photo', 'PUT', { image: img('pierwsze') }, p)).status, 200);
  assert.equal(keys().length, 1);
  const [path] = keys();
  assert.match(path, /^zielnik-photos\/[0-9a-f-]{36}\.png$/);
  assert.ok(!/tajna|aurora/i.test(path), 'w ścieżce nie ma nazwy odmiany');
  const put = blob.calls.put.at(-1);
  assert.equal(put.opts.access, 'private');
  assert.equal(put.opts.contentType, 'image/png');
  const [row] = await q`SELECT blob_path, data, uploaded_by FROM strain_photos WHERE strain_id = ${sid}`;
  assert.equal(row.blob_path, path);
  assert.equal(row.data, '', 'w bazie nie ma base64');

  // inny zalogowany użytkownik czyta przez trasę (proxy), cache tylko prywatny; bez sesji 401
  const g = await call(B, 'strains/[id]/photo', 'GET', null, p);
  assert.equal(g.status, 200);
  assert.equal(g.res.headers.get('content-type'), 'image/png');
  assert.match(g.res.headers.get('cache-control'), /^private/);
  assert.deepEqual(Buffer.from(await g.res.arrayBuffer()), bytes('pierwsze'));
  assert.equal((await call(null, 'strains/[id]/photo', 'GET', null, p)).status, 401);

  // obcy nie podmieni cudzego zdjęcia, a świeżo wysłany obiekt jest sprzątany
  const before_ = keys();
  assert.equal((await call(B, 'strains/[id]/photo', 'PUT', { image: img('obce') }, p)).status, 403);
  assert.deepEqual(keys(), before_);
  assert.equal((await call(B, 'strains/[id]/photo', 'DELETE', null, p)).status, 403);
  assert.deepEqual(keys(), before_);

  // podmiana przez dodającego usuwa stary obiekt
  assert.equal((await call(A, 'strains/[id]/photo', 'PUT', { image: img('drugie') }, p)).status, 200);
  assert.equal(keys().length, 1);
  assert.notEqual(keys()[0], path);
  const g2 = await call(B, 'strains/[id]/photo', 'GET', null, p);
  assert.deepEqual(Buffer.from(await g2.res.arrayBuffer()), bytes('drugie'));

  // usunięcie zdjęcia usuwa obiekt, potem 404
  assert.equal((await call(A, 'strains/[id]/photo', 'DELETE', null, p)).status, 200);
  assert.equal(keys().length, 0);
  assert.equal((await call(B, 'strains/[id]/photo', 'GET', null, p)).status, 404);
});

test('brak obiektu w Blob daje 404, a błąd usuwania z Blob nie psuje operacji (best effort)', { skip }, async () => {
  const { ania: A } = ids;
  const sid = (await call(A, 'strains', 'POST', { name: 'Zniknie', producer: 'Tilray', type: 'kush' })).json.id;
  const p = { id: String(sid) };
  await call(A, 'strains/[id]/photo', 'PUT', { image: img('x') }, p);
  blob.store.clear();
  assert.equal((await call(A, 'strains/[id]/photo', 'GET', null, p)).status, 404);
  await call(A, 'strains/[id]/photo', 'PUT', { image: img('y') }, p);
  blob.fail.del = true;
  const err = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try {
    assert.equal((await call(A, 'strains/[id]/photo', 'DELETE', null, p)).status, 200);
  } finally { console.error = err; blob.fail.del = false; }
  assert.equal((await q`SELECT 1 FROM strain_photos WHERE strain_id = ${sid}`).length, 0);
  assert.ok(logged.some((l) => l.includes('Blob')), 'błąd został zalogowany');
  blob.store.clear();
});

test('zdjęcie testu: widoczność wg can_see, podmiana, usunięcie zdjęcia i testu czyści Blob', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  blob.store.clear();
  const sid = (await call(A, 'strains', 'POST', { name: 'Testowa', producer: 'Aurora', type: 'haze' })).json.id;
  const r = await call(A, 'strains/[id]/tests', 'POST', { note: 'opis', image: img('t1'), visibility: 'me' }, { id: String(sid) });
  assert.equal(r.status, 200);
  const tid = r.json.tests[0].id;
  assert.equal(r.json.tests[0].hasPhoto, true);
  assert.equal(keys().length, 1);
  const [row] = await q`SELECT blob_path, data FROM strain_tests WHERE id = ${tid}`;
  assert.equal(row.blob_path, keys()[0]);
  assert.equal(row.data, '');
  const t = { tid: String(tid) };

  assert.equal((await call(B, 'tests/[tid]/photo', 'GET', null, t)).status, 404, 'prywatny test niewidoczny dla innych');
  assert.equal((await call(A, 'tests/[tid]/photo', 'GET', null, t)).status, 200);
  assert.equal((await call(A, 'tests/[tid]', 'PATCH', { note: 'opis', visibility: 'all' }, t)).status, 200);
  const g = await call(B, 'tests/[tid]/photo', 'GET', null, t);
  assert.equal(g.status, 200);
  assert.deepEqual(Buffer.from(await g.res.arrayBuffer()), bytes('t1'));
  assert.match(g.res.headers.get('cache-control'), /^private/);

  // nowe zdjęcie zastępuje stary obiekt
  const old = keys()[0];
  assert.equal((await call(A, 'tests/[tid]', 'PATCH', { note: 'opis', image: img('t2') }, t)).status, 200);
  assert.equal(keys().length, 1);
  assert.notEqual(keys()[0], old);
  // usunięcie samego zdjęcia
  assert.equal((await call(A, 'tests/[tid]', 'PATCH', { note: 'opis', removePhoto: true }, t)).status, 200);
  assert.equal(keys().length, 0);
  assert.equal((await q`SELECT blob_path, data FROM strain_tests WHERE id = ${tid}`)[0].blob_path, null);

  // usunięcie testu ze zdjęciem
  const r2 = await call(A, 'strains/[id]/tests', 'POST', { note: '', image: img('t3'), visibility: 'all' }, { id: String(sid) });
  const tid2 = r2.json.tests.find((x) => x.hasPhoto).id;
  assert.equal(keys().length, 1);
  assert.equal((await call(A, 'tests/[tid]', 'DELETE', null, { tid: String(tid2) })).status, 200);
  assert.equal(keys().length, 0);
});

test('usunięcie odmiany i konta usuwa zdjęcia z Blob; eksport z ?photos=1 zawiera base64 z Blob', { skip }, async () => {
  const { ania: A, celina: C } = ids;
  blob.store.clear();
  const sid = (await call(A, 'strains', 'POST', { name: 'Do usunięcia', producer: 'Aurora', type: 'haze' })).json.id;
  await call(A, 'strains/[id]/photo', 'PUT', { image: img('s') }, { id: String(sid) });
  await call(A, 'strains/[id]/tests', 'POST', { note: 'n', image: img('t') }, { id: String(sid) });
  assert.equal(keys().length, 2);

  const ex = await call(A, 'account/export', 'GET', null, {}, '?photos=1');
  const data = ex.json;
  assert.equal(data.strainPhotosAdded.find((x) => x.strain === 'Do usunięcia').photo_base64, bytes('s').toString('base64'));
  const mine = data.tests.find((x) => x.strain === 'Do usunięcia');
  assert.equal(mine.photo_base64, bytes('t').toString('base64'));
  assert.ok(!('blob_path' in mine));
  const plain = (await call(A, 'account/export', 'GET')).json;
  assert.equal(plain.tests.find((x) => x.strain === 'Do usunięcia').has_photo, true);

  assert.equal((await call(A, 'strains/[id]', 'DELETE', null, { id: String(sid) })).status, 200);
  assert.equal(keys().length, 0);

  // konto Celiny: test ze zdjęciem znika razem z kontem
  const s2 = (await call(A, 'strains', 'POST', { name: 'Wspólna', producer: 'Aurora', type: 'haze' })).json.id;
  await call(C, 'strains/[id]/tests', 'POST', { note: 'c', image: img('c') }, { id: String(s2) });
  assert.equal(keys().length, 1);
  const del = await call(C, 'account', 'DELETE', { password: 'haslo1234' });
  assert.equal(del.status, 200, JSON.stringify(del.json));
  assert.equal(keys().length, 0);
});

test('bez BLOB_READ_WRITE_TOKEN zdjęcia dalej trafiają do bazy jako base64', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  blob.store.clear();
  const putsBefore = blob.calls.put.length;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  try {
    const sid = (await call(A, 'strains', 'POST', { name: 'Bez tokenu', producer: 'Aurora', type: 'haze' })).json.id;
    const p = { id: String(sid) };
    assert.equal((await call(A, 'strains/[id]/photo', 'PUT', { image: img('b64') }, p)).status, 200);
    const [row] = await q`SELECT blob_path, data FROM strain_photos WHERE strain_id = ${sid}`;
    assert.equal(row.blob_path, null);
    assert.deepEqual(Buffer.from(row.data, 'base64'), bytes('b64'));
    const g = await call(B, 'strains/[id]/photo', 'GET', null, p);
    assert.deepEqual(Buffer.from(await g.res.arrayBuffer()), bytes('b64'));

    const r = await call(A, 'strains/[id]/tests', 'POST', { note: 'n', image: img('tb'), visibility: 'all' }, p);
    const tid = r.json.tests[0].id;
    const [t] = await q`SELECT blob_path, data FROM strain_tests WHERE id = ${tid}`;
    assert.equal(t.blob_path, null);
    assert.deepEqual(Buffer.from(t.data, 'base64'), bytes('tb'));
    const gt = await call(B, 'tests/[tid]/photo', 'GET', null, { tid: String(tid) });
    assert.deepEqual(Buffer.from(await gt.res.arrayBuffer()), bytes('tb'));
    assert.equal((await call(A, 'strains/[id]/photo', 'DELETE', null, p)).status, 200);
    assert.equal(blob.calls.put.length, putsBefore, 'Blob nie był używany');
  } finally { process.env.BLOB_READ_WRITE_TOKEN = 'test-token'; }
});

test('kopia zapasowa działa ze zdjęciami w Blob (strain_tests: ścieżka zamiast base64)', { skip }, async () => {
  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.ok(!('strain_photos' in b));
  for (const t of b.strain_tests) {
    assert.ok(!('data' in t), 'dane base64 nie trafiają do kopii');
    assert.ok('blob_path' in t);
  }
});

test('skrypt photos-to-blob: --dry-run nic nie zmienia, uruchomienie przenosi, powtórka jest pusta', { skip }, async () => {
  const { ania: A } = ids;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  let sid, tid;
  try {
    sid = (await call(A, 'strains', 'POST', { name: 'Migracja', producer: 'Aurora', type: 'haze' })).json.id;
    await call(A, 'strains/[id]/photo', 'PUT', { image: img('stare') }, { id: String(sid) });
    tid = (await call(A, 'strains/[id]/tests', 'POST', { note: 'n', image: img('stary-test') }, { id: String(sid) })).json.tests[0].id;
  } finally { process.env.BLOB_READ_WRITE_TOKEN = 'test-token'; }
  const [v0] = await q`SELECT updated_at FROM strain_photos WHERE strain_id = ${sid}`;

  const run = (...args) => spawnSync(process.execPath, ['--experimental-default-type=module', '--import', './tests/db/register.mjs', 'scripts/photos-to-blob.js', ...args], {
    cwd: new URL('../..', import.meta.url), encoding: 'utf8', env: { ...process.env, DATABASE_URL: URL_, BLOB_READ_WRITE_TOKEN: 'test-token', PHOTOS_BLOB: '1' },
  });
  const noFlag = spawnSync(process.execPath, ['--experimental-default-type=module', '--import', './tests/db/register.mjs', 'scripts/photos-to-blob.js'], {
    cwd: new URL('../..', import.meta.url), encoding: 'utf8', env: { ...process.env, DATABASE_URL: URL_, BLOB_READ_WRITE_TOKEN: 'test-token', PHOTOS_BLOB: '' },
  });
  assert.equal(noFlag.status, 2, 'bez PHOTOS_BLOB=1 skrypt odmawia');
  const dry = run('--dry-run');
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, /\[dry-run\] Znaleziono [2-9]/);
  assert.equal((await q`SELECT blob_path FROM strain_photos WHERE strain_id = ${sid}`)[0].blob_path, null);

  const real = run('--batch=1');
  assert.equal(real.status, 0, real.stderr);
  const [ph] = await q`SELECT blob_path, data, updated_at FROM strain_photos WHERE strain_id = ${sid}`;
  const [te] = await q`SELECT blob_path, data FROM strain_tests WHERE id = ${tid}`;
  for (const r of [ph, te]) { assert.match(r.blob_path, /^zielnik-photos\//); assert.equal(r.data, ''); }
  assert.deepEqual(ph.updated_at, v0.updated_at, 'updated_at (klucz cache) bez zmian');

  const again = run();
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /Znaleziono 0, przeniesiono 0/);
});

test('z tokenem, ale bez PHOTOS_BLOB=1 nowe zdjęcia idą do bazy; odczyt blob_path bez tokenu daje 404', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  blob.store.clear();
  const puts = blob.calls.put.length;
  process.env.PHOTOS_BLOB = '';
  let sid;
  try {
    sid = (await call(A, 'strains', 'POST', { name: 'Opt-in', producer: 'Aurora', type: 'haze' })).json.id;
    assert.equal((await call(A, 'strains/[id]/photo', 'PUT', { image: img('flaga') }, { id: String(sid) })).status, 200);
  } finally { process.env.PHOTOS_BLOB = '1'; }
  const [row] = await q`SELECT blob_path, data FROM strain_photos WHERE strain_id = ${sid}`;
  assert.equal(row.blob_path, null);
  assert.deepEqual(Buffer.from(row.data, 'base64'), bytes('flaga'));
  assert.equal(blob.calls.put.length, puts);

  // blob_path w bazie, ale brak tokenu: 404 (z logiem), nie 500
  await q`UPDATE strain_photos SET blob_path = 'zielnik-photos/x.png', data = '' WHERE strain_id = ${sid}`;
  const tok = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN;
  const err = console.error;
  const logged = [];
  console.error = (...a) => logged.push(a.join(' '));
  try {
    assert.equal((await call(B, 'strains/[id]/photo', 'GET', null, { id: String(sid) })).status, 404);
  } finally { console.error = err; process.env.BLOB_READ_WRITE_TOKEN = tok; }
  assert.ok(logged.length > 0);
  // z tokenem, ale bez obiektu (get() zwraca null): też 404
  assert.equal((await call(B, 'strains/[id]/photo', 'GET', null, { id: String(sid) })).status, 404);
});
