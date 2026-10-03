// Import zdjęć z wolnych licencji: tylko odmiany bez zdjęcia, tylko zweryfikowane i pasujące nazwą, z atrybucją, idempotentnie.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, importPhotos, real, uid, jar, auth, listStrains;

// minimalny JPEG (nagłówek FFD8) wystarczy: import sprawdza tylko sygnaturę
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 1)]);
const calls = [];
const fakeFetch = async (url) => {
  calls.push(url);
  if (url.includes('zly')) return new Response('<html>', { status: 200 });
  if (url.includes('brak')) return new Response('nie ma', { status: 404 });
  return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
};

const P = (id, o = {}) => ({ id, fileUrl: `https://upload.wikimedia.org/${id}.jpg`, thumbUrl: `https://upload.wikimedia.org/${id}-960.jpg`, sourcePage: `https://commons.wikimedia.org/wiki/File:${id}.jpg`,
  author: 'Jan Autor', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', depicts: 'odmiana', strain: 'Pink Kush', verified: true, ...o });
const MANIFEST = { photos: [
  P('pk'),
  P('pogl', { depicts: 'poglądowe', strain: undefined }),
  P('niezw', { strain: 'Delahaze', verified: false }),
  P('zla-lic', { strain: 'Bakerstreet', license: 'All rights reserved' }),
  P('zly-plik', { strain: 'Black R', thumbUrl: 'https://upload.wikimedia.org/zly.jpg' }),
  P('obcy-host', { strain: 'Blue Monkey', thumbUrl: 'https://example.com/x.jpg' }),
  P('brak', { strain: 'Gorilla Girl', thumbUrl: 'https://upload.wikimedia.org/brak.jpg' }),
] };

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ jar } = await import('./headers-shim.mjs'));
  auth = await import('../../lib/auth.js');
  ({ listStrains } = await import('../../lib/strains.js'));
  ({ importPhotos } = await import('../../lib/photo-import.js'));
  real = (await import('../../data/zdjecia.json', { with: { type: 'json' } })).default;
  await db.ensureDb();
  q = db.sql();
  [{ id: uid }] = await q`SELECT id FROM users WHERE is_admin LIMIT 1`;
});

after(async () => { if (pool) await pool.end(); });

const add = async (name, producer = 'Tilray') => (await q`INSERT INTO strains (producer, name, type, created_by) VALUES (${producer}, ${name}, 'x', ${uid}) RETURNING id`)[0].id;
const photo = async (id) => (await q`SELECT mime, data, uploaded_by, credit, license, license_url, source_url FROM strain_photos WHERE strain_id = ${id}`)[0];

test('manifest w repozytorium: zweryfikowane wpisy mają autora, wolną licencję i adres źródła; poglądowe bez odmiany', { skip }, () => {
  assert.ok(real.photos.length >= 6);
  for (const p of real.photos) {
    if (!p.verified) continue;
    assert.ok(p.author && p.sourcePage && p.thumbUrl, p.id);
    assert.match(p.license, /^(domena publiczna|CC0|CC BY(-SA)? \d\.\d)$/, p.id);
    if (p.depicts === 'poglądowe') assert.ok(!p.strain, `poglądowe nie ma odmiany: ${p.id}`);
    else assert.ok(p.strain, p.id);
  }
});

test('import dodaje zdjęcie z atrybucją tylko pasującej odmianie bez zdjęcia; reszta trafia do błędów, nic nie jest zgadywane', { skip }, async () => {
  const pk = await add('pink kush');
  const dela = await add('Delahaze');       // wpis niezweryfikowany
  const baker = await add('Bakerstreet');   // licencja spoza listy
  const blackr = await add('Black R');      // plik to nie obraz
  const monkey = await add('Blue Monkey');  // obcy host
  const gg = await add('Gorilla Girl');     // HTTP 404
  const other = await add('Inna odmiana');  // brak wpisu w manifeście
  const r = await importPhotos(MANIFEST, fakeFetch);
  assert.equal(r.assigned, 1);
  assert.equal(r.general, 1);
  assert.equal(r.candidates, 4);
  const p = await photo(pk);
  assert.equal(p.mime, 'image/jpeg');
  assert.equal(Buffer.from(p.data, 'base64').length, JPEG.length);
  assert.equal(p.uploaded_by, null);
  assert.equal(p.credit, 'Jan Autor');
  assert.equal(p.license, 'CC BY-SA 4.0');
  assert.match(p.license_url, /creativecommons/);
  assert.match(p.source_url, /commons\.wikimedia\.org/);
  for (const id of [dela, baker, blackr, monkey, gg, other]) assert.equal(await photo(id), undefined);
  assert.equal(r.failed.length, 3);
  assert.ok(r.failed.some((x) => x.startsWith('Black R')) && r.failed.some((x) => x.startsWith('Blue Monkey')) && r.failed.some((x) => x.startsWith('Gorilla Girl')));
  assert.ok(!calls.some((u) => u.includes('example.com')), 'obcy host nie jest pobierany');
});

test('ponowny import jest idempotentny i nie nadpisuje zdjęć użytkowników ani poglądowych nie przypisuje', { skip }, async () => {
  const mine = await add('Pink Kush 2');
  await q`UPDATE strains SET name = 'Pink Kush', producer = 'Cosma' WHERE id = ${mine}`;   // druga odmiana o tej nazwie, ze zdjęciem użytkownika
  await q`INSERT INTO strain_photos (strain_id, mime, data, uploaded_by) VALUES (${mine}, 'image/png', 'QUJD', ${uid})`;
  const before_ = calls.length;
  const r = await importPhotos(MANIFEST, fakeFetch);
  assert.equal(r.assigned, 0);
  const p = await photo(mine);
  assert.equal(p.data, 'QUJD');
  assert.equal(p.credit, null);
  assert.equal((await q`SELECT count(*)::int AS n FROM strain_photos WHERE credit IS NOT NULL`)[0].n, 1);
  assert.ok(calls.slice(before_).every((u) => !u.includes('pogl')));
});

test('odmiana dopisana później dostaje to samo zdjęcie (jedno pobranie na wpis), poglądowe nigdy', { skip }, async () => {
  const id = await add('PINK  kush', 'Canopy Growth');
  const start = calls.length;
  const r = await importPhotos(MANIFEST, fakeFetch);
  assert.equal(r.assigned, 1);
  assert.equal((await photo(id)).credit, 'Jan Autor');
  assert.equal(calls.slice(start).filter((u) => u.includes('pk-960')).length, 1);
  const all = await q`SELECT count(*)::int AS n FROM strain_photos WHERE source_url LIKE '%pogl%'`;
  assert.equal(all[0].n, 0);
});

test('lista odmian niesie atrybucję, a zdjęcie podmienione przez człowieka ją traci', { skip }, async () => {
  const [{ id }] = await q`SELECT strain_id AS id FROM strain_photos WHERE credit IS NOT NULL ORDER BY strain_id LIMIT 1`;
  const [s] = await listStrains(uid, { ids: [id] });
  assert.deepEqual(s.photo_attr, { credit: 'Jan Autor', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0', sourceUrl: s.photo_attr.sourceUrl });
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${uid}`;
  jar.clear(); await auth.createSession(uid);
  const mod = await import('../../app/api/strains/[id]/photo/route.js');
  const image = 'data:image/jpeg;base64,' + Buffer.from('nowe').toString('base64');
  const r = await mod.PUT(new Request('http://localhost/x', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image }) }), { params: Promise.resolve({ id: String(id) }) });
  assert.equal(r.status, 200);
  const p = await photo(id);
  assert.equal(p.credit, null);
  assert.equal(p.license, null);
  assert.equal(p.source_url, null);
  assert.equal(p.uploaded_by, uid);
  assert.equal((await listStrains(uid, { ids: [id] }))[0].photo_attr, null);
});
