// Audyt bezpieczeństwa (docs/BEZPIECZENSTWO.md): zgłoszenia cudzych testów, enumeracja kont, metadane zdjęć,
// nagłówki cache, eksport z polską nazwą, limity, import zdjęć z przekierowaniami, wylogowanie z tokenem FCM.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { jpeg, jpegBytes, png } from './images.mjs';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, client, pool, createSession;
const ids = {};
const FCM = 'dQw4w9WgXcQ:APA91bHun4MxP5egoKMwt2KZFBaFUH-1RYqx_Example-Token_0123456789abcdefghijklmnopqrstuvwxyz';

// Wywołanie trasy jako zalogowany użytkownik (uid = null: bez sesji); zwraca odpowiedź, nagłówki i JSON
async function call(uid, route, method, body, params = {}, query = '') {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}${query}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.clone().json() : null;
  return { status: res.status, json, headers: res.headers, res };
}
const register = (username, invite = 'AUDYT', ip = '10.9.0.1') => {
  client.ip = ip;
  return call(null, 'auth/register', 'POST', { username, password: 'haslo1234', invite, adult: true, consent: true });
};

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  delete process.env.BLOB_READ_WRITE_TOKEN;
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar, client } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('AUDYT', 20)`;
  for (const [i, n] of ['ola', 'piotr', 'łucja'].entries()) assert.equal((await register(n, 'AUDYT', `10.9.1.${i}`)).status, 200);
  for (const u of await q`SELECT id, username FROM users`) ids[u.username.toLowerCase()] = u.id;
  await q`UPDATE users SET must_change_password = FALSE WHERE lower(username) = 'bocian'`;
});

after(async () => { if (client) client.ip = '127.0.0.1'; if (pool) await pool.end(); });

test('zgłoszenie testu: tylko test zgłaszanej osoby i widoczny dla zgłaszającego; admin nie usunie cudzego', { skip }, async () => {
  const { ola: O, piotr: P, łucja: L } = ids;
  const sid = (await call(O, 'strains', 'POST', { name: 'Zgłoszona', producer: 'Aurora', type: 'haze' })).json.id;
  await call(O, 'strains/[id]/tests', 'POST', { note: 'moja prywatna notatka', visibility: 'me' }, { id: String(sid) });
  await call(L, 'strains/[id]/tests', 'POST', { note: 'publiczny test Łucji', visibility: 'all' }, { id: String(sid) });
  const [priv] = await q`SELECT id FROM strain_tests WHERE user_id = ${O}`;
  const [pub] = await q`SELECT id FROM strain_tests WHERE user_id = ${L}`;
  // prywatny test Oli: Piotr go nie widzi, więc nie może go zgłosić (ani wskazać jako cudzego)
  assert.equal((await call(P, 'reports', 'POST', { type: 'test', userId: O, ref: priv.id, reason: 'spam' })).status, 404);
  assert.equal((await call(P, 'reports', 'POST', { type: 'test', userId: L, ref: priv.id, reason: 'spam' })).status, 404);
  assert.equal((await call(P, 'reports', 'POST', { type: 'test', userId: O, ref: pub.id, reason: 'spam' })).status, 404, 'test innej osoby');
  assert.equal((await call(P, 'reports', 'POST', { type: 'user', userId: 999999, reason: 'spam' })).status, 404);
  assert.equal((await call(P, 'reports', 'POST', { type: 'test', userId: L, ref: pub.id, reason: 'spam' })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM reports`)[0].n, 1);

  // zgłoszenie zapisane wcześniej z niepasującym ref (sprzed poprawki): admin nie widzi notatki i nie usuwa testu
  const [bad] = await q`INSERT INTO reports (reporter_id, target_user_id, type, ref, reason) VALUES (${P}, ${L}, 'test', ${priv.id}, 'spam') RETURNING id`;
  const list = (await call(ids.bocian, 'admin/reports', 'GET')).json.reports;
  assert.equal(list.find((r) => r.id === bad.id).test_note, null);
  assert.equal(list.find((r) => r.id !== bad.id).test_note, 'publiczny test Łucji');
  assert.equal((await call(ids.bocian, 'admin/reports', 'POST', { id: bad.id, deleteContent: true })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM strain_tests WHERE id = ${priv.id}`)[0].n, 1, 'cudzy test został');
});

test('rejestracja: bez ważnego zaproszenia nie widać, czy nazwa jest zajęta', { skip }, async () => {
  const bad = await register('ola', 'ZLY-KOD', '10.9.2.1');
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /kod zaproszenia/);
  const taken = await register('ola', 'AUDYT', '10.9.2.2');
  assert.equal(taken.status, 409, 'z ważnym kodem komunikat o zajętej nazwie zostaje');
  assert.equal((await q`SELECT uses FROM invites WHERE code = 'AUDYT'`)[0].uses, 3, 'odrzucone próby nie zużywają kodu');
});

test('logowanie: nieistniejące konto liczy bcrypt jak istniejące (czas nie zdradza kont)', { skip }, async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const src = (await import('node:fs')).readFileSync(new URL('../../app/api/auth/login/route.js', import.meta.url), 'utf8');
  const dummy = /DUMMY_HASH = '([^']+)'/.exec(src)?.[1];
  assert.ok(dummy && bcrypt.getRounds(dummy) === 10, 'stały hash z kosztem 10, jak hasła użytkowników');
  assert.match(src, /u\?\.password_hash \|\| DUMMY_HASH\)/, "bcrypt liczony także bez konta");
  const login = async (username) => {
    jar.clear(); client.ip = `10.9.3.${Math.floor(Math.random() * 200)}`;
    return call(null, 'auth/login', 'POST', { username, password: 'zle-haslo-123' });
  };
  const known = await login('ola'), unknown = await login('nie-ma-takiego-konta');
  assert.equal(known.status, 401); assert.equal(unknown.status, 401);
  assert.equal(known.json.error, unknown.json.error);
});

test('zdjęcia: EXIF (GPS) usunięty przy zapisie zdjęcia odmiany, testu i awatara; fałszywy typ odrzucony', { skip }, async () => {
  const { ola: O } = ids;
  const sid = (await call(O, 'strains', 'POST', { name: 'Z GPS', producer: 'Aurora', type: 'haze' })).json.id;
  const p = { id: String(sid) };
  assert.equal((await call(O, 'strains/[id]/photo', 'PUT', { image: jpeg('s', { meta: true }) }, p)).status, 200);
  const [ph] = await q`SELECT data FROM strain_photos WHERE strain_id = ${sid}`;
  assert.deepEqual(Buffer.from(ph.data, 'base64'), jpegBytes('s'), 'bez APP1/COM, reszta bez zmian');

  const t = await call(O, 'strains/[id]/tests', 'POST', { note: 'n', image: png('t', { meta: true }), visibility: 'friends' }, p);
  assert.equal(t.status, 200);
  const [tr] = await q`SELECT id, data FROM strain_tests WHERE user_id = ${O} AND strain_id = ${sid}`;
  assert.ok(!Buffer.from(tr.data, 'base64').includes('GPS'));
  assert.equal((await call(O, 'tests/[tid]', 'PATCH', { note: 'n', image: jpeg('t2', { meta: true }) }, { tid: String(tr.id) })).status, 200);
  assert.ok(!Buffer.from((await q`SELECT data FROM strain_tests WHERE id = ${tr.id}`)[0].data, 'base64').includes('GPSLatitude'));

  assert.equal((await call(O, 'profile', 'PUT', { displayName: 'Ola', avatar: png('a', { meta: true }) })).status, 200);
  const [u] = await q`SELECT avatar FROM users WHERE id = ${O}`;
  assert.ok(!Buffer.from(u.avatar.split(',')[1], 'base64').includes('GPS'));

  const html = `data:image/png;base64,${Buffer.from('<html><script>alert(1)</script>').toString('base64')}`;
  assert.equal((await call(O, 'strains/[id]/photo', 'PUT', { image: html }, p)).status, 400);
  assert.equal((await call(O, 'strains/[id]/tests', 'POST', { note: '', image: html }, p)).status, 400);
  const before_ = (await q`SELECT display_name FROM users WHERE id = ${O}`)[0].display_name;
  assert.equal((await call(O, 'profile', 'PUT', { displayName: 'Zmienione', avatar: html })).status, 400);
  assert.equal((await q`SELECT display_name FROM users WHERE id = ${O}`)[0].display_name, before_, 'błędny awatar nie zapisuje profilu');
});

test('nagłówki: API z no-store, zdjęcia z prywatnym cache i Vary: Cookie; eksport z polską nazwą działa', { skip }, async () => {
  const { ola: O, łucja: L } = ids;
  assert.equal((await call(O, 'strains', 'GET')).headers.get('cache-control'), 'no-store');
  assert.equal((await call(null, 'strains', 'GET')).headers.get('cache-control'), 'no-store', 'także błąd 401');
  const [{ strain_id: sid }] = await q`SELECT strain_id FROM strain_photos LIMIT 1`;
  const ph = await call(O, 'strains/[id]/photo', 'GET', null, { id: String(sid) });
  assert.match(ph.headers.get('cache-control'), /^private/);
  assert.equal(ph.headers.get('vary'), 'Cookie');
  const ex = await call(L, 'account/export', 'GET');
  assert.equal(ex.status, 200, 'nazwa z „ł” nie może wywracać eksportu RODO');
  assert.equal(ex.headers.get('cache-control'), 'no-store');
  assert.match(ex.headers.get('content-disposition'), /filename="zielnik-moje-dane-ucja\.json"; filename\*=UTF-8''zielnik-moje-dane-%C5%82ucja\.json/);
});

test('limity: import CSV 20/h na konto, zgłoszenia 20/h', { skip }, async () => {
  const { piotr: P, ola: O } = ids;
  for (let i = 0; i < 20; i++) assert.equal((await call(P, 'import', 'POST', { rows: [{ name: '' }] })).status, 200);
  assert.equal((await call(P, 'import', 'POST', { rows: [{ name: '' }] })).status, 429);
  await q`DELETE FROM rate_limits WHERE key LIKE 'report:%'`;
  for (let i = 0; i < 20; i++) await call(P, 'reports', 'POST', { type: 'user', userId: O, reason: 'other' });
  assert.equal((await call(P, 'reports', 'POST', { type: 'user', userId: O, reason: 'other' })).status, 429);
});

test('błędne identyfikatory w treści nie dają 500 (intId)', { skip }, async () => {
  const { ola: O } = ids;
  assert.equal((await call(O, 'prescriptions', 'DELETE', { id: 'abc' })).status, 200);
  assert.equal((await call(O, 'prescriptions', 'DELETE', { id: 1e12 })).status, 200);
  assert.equal((await call(O, 'blocks', 'POST', { action: 'block', userId: 2 ** 40 })).status, 400);
  assert.equal((await call(O, 'friends', 'POST', { action: 'request', userId: 'x' })).status, 400);
  assert.equal((await q`SELECT count(*)::int AS n FROM error_log`)[0].n, 0);
});

test('dziennik błędów: ścieżka bez parametrów zapytania', { skip }, async () => {
  const { logError } = await import('../../lib/errorlog.js');
  await logError('test', new Error('x'), { path: '/szukaj?q=Pink+Kush#wynik' });
  assert.equal((await q`SELECT path FROM error_log WHERE source = 'test'`)[0].path, '/szukaj');
  await q`DELETE FROM error_log`;
});

test('import zdjęć: przekierowanie poza dozwolone hosty i zbyt duży plik odrzucone, dozwolone przekierowanie działa', { skip }, async () => {
  const { importPhotos } = await import('../../lib/photo-import.js');
  for (const name of ['Przekierowana', 'Uciekająca', 'Ogromna']) await call(ids.ola, 'strains', 'POST', { name, producer: 'Aurora', type: 'haze' });
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push(url);
    assert.equal(opts.redirect, 'manual');
    if (url.includes('/ucieka')) return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
    if (url.includes('/dalej')) return new Response(null, { status: 301, headers: { location: '/cel.jpg' } });
    if (url.includes('/ogromna')) return new Response(jpegBytes('x'), { status: 200, headers: { 'content-length': '99999999' } });
    return new Response(jpegBytes('ok', { meta: true }), { status: 200 });
  };
  const P = (strain, path) => ({ id: strain, strain, thumbUrl: `https://upload.wikimedia.org${path}`, author: 'A', license: 'CC0', licenseUrl: 'javascript:alert(1)',
    sourcePage: 'https://commons.wikimedia.org/x', depicts: 'odmiana', verified: true });
  const r = await importPhotos({ photos: [P('Przekierowana', '/dalej.jpg'), P('Uciekająca', '/ucieka.jpg'), P('Ogromna', '/ogromna.jpg')] }, fetchFn);
  assert.equal(r.assigned, 1, JSON.stringify(r.failed));
  assert.ok(!calls.some((u) => u.includes('169.254')), 'nie wysłano żądania pod adres z przekierowania');
  assert.ok(r.failed.some((f) => /Uciekająca: niedozwolony host/.test(f)));
  assert.ok(r.failed.some((f) => /Ogromna: plik za duży/.test(f)));
  const [ph] = await q`SELECT p.data, p.license_url, p.source_url FROM strain_photos p JOIN strains s ON s.id = p.strain_id WHERE s.name = 'Przekierowana'`;
  assert.deepEqual(Buffer.from(ph.data, 'base64'), jpegBytes('ok'), 'zdjęcie bez EXIF');
  assert.equal(ph.license_url, null, 'tylko adresy https');
  assert.equal(ph.source_url, 'https://commons.wikimedia.org/x');
});

test('wylogowanie z tokenem FCM usuwa urządzenie z przypomnień tego konta', { skip }, async () => {
  const { piotr: P } = ids;
  assert.equal((await call(P, 'push/subscription', 'POST', { kind: 'fcm', token: FCM, claim: true })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${P}`)[0].n, 1);
  assert.equal((await call(P, 'auth/logout', 'POST', { fcmToken: FCM })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${P}`)[0].n, 0);
});

test('usunięcie konta przez admina kasuje zdjęcia testów z Blob', { skip }, async () => {
  const blob = await import('./blob-shim.mjs');
  process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
  process.env.PHOTOS_BLOB = '1';
  try {
    assert.equal((await register('do-usuniecia', 'AUDYT', '10.9.4.1')).status, 200);
    const [{ id: U }] = await q`SELECT id FROM users WHERE username = 'do-usuniecia'`;
    const sid = (await call(U, 'strains', 'POST', { name: 'Blob konta', producer: 'Aurora', type: 'haze' })).json.id;
    assert.equal((await call(U, 'strains/[id]/tests', 'POST', { note: 'n', image: png('konto') }, { id: String(sid) })).status, 200);
    const [{ blob_path: path }] = await q`SELECT blob_path FROM strain_tests WHERE user_id = ${U}`;
    assert.ok(blob.store.has(path));
    assert.equal((await call(ids.bocian, 'admin/users/[id]', 'DELETE', null, { id: String(U) })).status, 200);
    assert.ok(!blob.store.has(path), 'obiekt usunięty z Blob');
    assert.ok(blob.calls.del.some((d) => d.includes(path)));
  } finally { delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.PHOTOS_BLOB; }
});

test('zadania cykliczne: bez CRON_SECRET zawsze 401, zły sekret 401', { skip }, async () => {
  const cron = async (route, auth) => {
    const mod = await import(`../../app/api/cron/${route}/route.js`);
    return (await mod.GET(new Request(`http://localhost/api/cron/${route}`, { headers: auth ? { authorization: auth } : {} }))).status;
  };
  const old = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    for (const r of ['backup', 'catalog', 'reminders']) {
      assert.equal(await cron(r), 401);
      assert.equal(await cron(r, 'Bearer '), 401);
      assert.equal(await cron(r, 'Bearer undefined'), 401);
    }
    process.env.CRON_SECRET = 'sekret-audytu';
    assert.equal(await cron('backup', 'Bearer sekret-audyt'), 401);
    assert.equal(await cron('backup', 'bearer sekret-audytu'), 401);
  } finally { if (old === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = old; }
});
