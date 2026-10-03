// Zdjęcie z apteki -> katalog: trasa admina (bez klucza, z podmienionym fetch) i scalanie listy częściowej
// (POST /api/catalog z mode 'zdjecie': bez oznaczania braków, bez kasowania danych pustymi polami, źródło bez zmian).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const IMG = 'data:image/jpeg;base64,' + Buffer.from('obraz').toString('base64');
let q, jar, pool, auth, syncCatalog;
const ids = {};
const realFetch = globalThis.fetch;

async function req(route, method, body) {
  const mod = await import(`../../app/api/${route}/route.js`);
  const r = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](r, { params: Promise.resolve({}) });
  return { status: res.status, json: await res.json() };
}
async function as(uid) { jar.clear(); await auth.createSession(uid); }
const row = (producer, name) => q`SELECT thc::float8 AS thc, cbd::float8 AS cbd, kind, form, availability, source, active
                                  FROM market_catalog WHERE lower(producer) = lower(${producer}) AND lower(name) = lower(${name})`.then((r) => r[0]);

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  auth = await import('../../lib/auth.js');
  ({ syncCatalog } = await import('../../lib/catalog.js'));
  await db.ensureDb();
  q = db.sql();
  [{ id: ids.bocian }] = await q`SELECT id FROM users WHERE lower(username) = 'bocian'`;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${ids.bocian}`;
  [{ id: ids.kasia }] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES ('kasia', 'x', FALSE) RETURNING id`;
});

after(async () => { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; if (pool) await pool.end(); });

test('odczyt zdjęcia: tylko admin, bez klucza jasny komunikat, walidacja zdjęć', { skip }, async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await as(ids.kasia);
  assert.equal((await req('admin/pharmacy-photo', 'GET')).status, 403);
  assert.equal((await req('admin/pharmacy-photo', 'POST', { images: [IMG] })).status, 403);
  jar.clear();
  assert.equal((await req('admin/pharmacy-photo', 'GET')).status, 401);
  await as(ids.bocian);
  const g = await req('admin/pharmacy-photo', 'GET');
  assert.deepEqual(g.json, { configured: false, model: 'claude-opus-5-5' });
  const r = await req('admin/pharmacy-photo', 'POST', { images: [IMG] });
  assert.equal(r.status, 503);
  assert.match(r.json.error, /ANTHROPIC_API_KEY/);
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  assert.equal((await req('admin/pharmacy-photo', 'GET')).json.configured, true);
  assert.match((await req('admin/pharmacy-photo', 'POST', { images: ['data:image/gif;base64,AAAA'] })).json.error, /format/);
  assert.match((await req('admin/pharmacy-photo', 'POST', {})).json.error, /co najmniej/);
});

test('odczyt zdjęcia: wiersze z modelu (podmieniony fetch), oznaczenie „jest w katalogu”, błąd API bez treści w dzienniku', { skip }, async () => {
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  await syncCatalog([{ producent: 'Aurora', odmiana: 'Pink Kush', thc: '20' }], 'import ręczny');
  await as(ids.bocian);
  const items = [
    { cannabis: true, registeredName: 'Cannabis flos Aurora THC 20%, CBD < 1% (Pink Kush)', producer: 'Aurora Deutschland GmbH', strainName: '', thc: '20', cbd: '<1', concUnit: '%', form: 'susz', size: '10', unit: 'g', price: '399', kind: '', uncertain: [] },
    { cannabis: true, registeredName: 'Cannabis sativae extractum THC 25 mg/ml', producer: 'Medicolab', strainName: '', thc: '25', cbd: '', concUnit: 'mg/ml', form: 'olej', size: '30', unit: 'ml', price: '', kind: '', uncertain: ['price'] },
  ];
  let sent;
  globalThis.fetch = async (url, init) => {
    sent = JSON.parse(init.body);
    return new Response(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ items }) }] }), { status: 200 });
  };
  const r = await req('admin/pharmacy-photo', 'POST', { images: [IMG] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(sent.messages[0].content[0].type, 'image');
  assert.deepEqual(r.json.rows.map((x) => [x.producer, x.name, x.form, x.unit, x.exists]),
    [['Aurora', 'Pink Kush', 'susz', 'g', true], ['Medicolab', 'Cannabis sativae extractum THC 25 mg/ml', 'olej', 'ml', false]]);
  const [a] = await q`SELECT details FROM audit_log ORDER BY id DESC LIMIT 1`;
  assert.equal(a.details, 'zdjęć 1, pozycji 2');

  globalThis.fetch = async () => new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Cannabis flos tajne' } }), { status: 529 });
  const e = await req('admin/pharmacy-photo', 'POST', { images: [IMG] });
  assert.equal(e.status, 502);
  const [log] = await q`SELECT message FROM error_log ORDER BY id DESC LIMIT 1`;
  assert.equal(log.message, 'Anthropic 529 overloaded_error');
  globalThis.fetch = realFetch;
});

test('import ze zdjęcia scala listę częściową: bez „Brak w źródle”, puste pola nie kasują danych, źródło bez zmian', { skip }, async () => {
  await q`DELETE FROM market_catalog`;
  await syncCatalog([
    { producent: 'Aurora', odmiana: 'Pink Kush', thc: '20', cbd: '1', rodzaj: 'indica', dostępność: 'dostępna' },
    { producent: 'S-LAB', odmiana: 'Ghost Train Haze', thc: '22' },
  ], 'import ręczny');

  await as(ids.kasia);
  assert.equal((await req('catalog', 'POST', { rows: [{ producent: 'X', odmiana: 'Y' }], mode: 'zdjecie' })).status, 403);
  await as(ids.bocian);
  const r = await req('catalog', 'POST', { mode: 'zdjecie', rows: [
    { producent: 'aurora', odmiana: 'PINK KUSH', thc: '', cbd: '', rodzaj: '', postać: 'susz', dostępność: '' },
    { producent: 'Medicolab', odmiana: 'Cannabis sativae extractum THC 25 mg/ml', thc: '', cbd: '', rodzaj: '', postać: 'olej', dostępność: '' },
  ] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.upserted, 2);
  assert.equal(r.json.deactivated, 0);
  assert.equal((await q`SELECT count(*)::int AS n FROM market_catalog`)[0].n, 3, 'bez duplikatu (producent + nazwa bez wielkości liter)');

  const pink = await row('Aurora', 'Pink Kush');
  assert.deepEqual(pink, { thc: 20, cbd: 1, kind: 'indica', form: 'susz', availability: 'dostępna', source: 'import ręczny', active: true });
  assert.equal((await row('S-LAB', 'Ghost Train Haze')).active, true, 'pozycja spoza zdjęcia zostaje aktualna');
  const oil = await row('Medicolab', 'Cannabis sativae extractum THC 25 mg/ml');
  assert.deepEqual([oil.form, oil.thc, oil.source], ['olej', null, 'zdjęcie z apteki']);

  // pełny import ręczny dalej oznacza braki w swoim źródle, a pozycja ze zdjęcia (inne źródło) zostaje
  await syncCatalog([{ producent: 'S-LAB', odmiana: 'Ghost Train Haze', thc: '22' }], 'import ręczny');
  assert.equal((await row('Aurora', 'Pink Kush')).active, false);
  assert.equal((await row('Medicolab', 'Cannabis sativae extractum THC 25 mg/ml')).active, true);
});
