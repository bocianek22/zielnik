// Uzupełnianie odmian z katalogu Zielnika: tylko puste pola, historia z autorem "Zielnik (katalog)", idempotencja.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, enrichStrains, listHistory, ENRICH_ACTOR, real;
let uid;

const CATALOG = [
  { producer: 'Aurora', producerAliases: ['Aurora Deutschland GmbH'], name: 'Delahaze', aliases: ['Delahaze 22'], terpenes: ['Terpinolen', 'Mircen'], taste: 'owocowy', description: 'Opis katalogowy Delahaze.', sources: [{ title: 'Źródło A', url: 'https://example.com/a' }] },
  { producer: 'Cosma', producerAliases: ['Cosma S.A.'], name: 'Black R', aliases: [], terpenes: ['Kariofilen'], taste: 'ziemisty', description: 'Opis Black R.', sources: [] },
  { producer: 'Aurora', producerAliases: [], name: 'Dubel', aliases: ['Wspólna'], terpenes: ['Limonen'], taste: 'x', description: 'x', sources: [] },
  { producer: 'Aurora', producerAliases: [], name: 'Dubel 2', aliases: ['Wspólna'], terpenes: ['Mircen'], taste: 'y', description: 'y', sources: [] },
];

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ enrichStrains, ENRICH_ACTOR } = await import('../../lib/enrich.js'));
  ({ listHistory } = await import('../../lib/strains.js'));
  real = (await import('../../data/odmiany.json', { with: { type: 'json' } })).default;
  await db.ensureDb();
  q = db.sql();
  [{ id: uid }] = await q`SELECT id FROM users WHERE is_admin LIMIT 1`;
});

after(async () => { if (pool) await pool.end(); });

const add = async (producer, name, f = {}) => (await q`
  INSERT INTO strains (producer, name, type, taste, terpenes, description, created_by)
  VALUES (${producer}, ${name}, 'haze', ${f.taste ?? ''}, ${JSON.stringify(f.terpenes ?? [])}::jsonb, ${f.description ?? ''}, ${uid}) RETURNING id`)[0].id;
const get = async (id) => (await q`SELECT taste, terpenes, description, description_auto, sources FROM strains WHERE id = ${id}`)[0];
const edits = (id) => q`SELECT user_id, actor, changes FROM strain_edits WHERE strain_id = ${id} ORDER BY id`;

test('katalog w repozytorium ma poprawny kształt (terpeny z listy, smak do 120 znaków, min. 2 źródła)', { skip }, async () => {
  const known = (await q`SELECT value FROM options WHERE kind = 'terpene'`).map((r) => r.value);
  const prods = (await q`SELECT value FROM options WHERE kind = 'producer'`).map((r) => r.value);
  assert.ok(real.strains.length >= 15);
  for (const e of real.strains) {
    assert.ok(prods.includes(e.producer), `producent ${e.producer}`);
    assert.ok(e.sources.length >= 2, `źródła ${e.name}`);
    assert.ok(e.taste.length <= 120, `smak ${e.name}`);
    for (const t of e.terpenes) assert.ok(known.includes(t), `terpen ${t} (${e.name})`);
    for (const s of e.sources) assert.match(s.url, /^https:\/\//);
  }
});

test('puste pola są uzupełniane, historia ma autora "Zielnik (katalog)", opis dostaje znacznik poglądowego', { skip }, async () => {
  const id = await add('Aurora', 'delahaze');
  const r = await enrichStrains(CATALOG);
  assert.equal(r.updated >= 1, true);
  const s = await get(id);
  assert.equal(s.taste, 'owocowy');
  assert.deepEqual(s.terpenes, ['Terpinolen', 'Mircen']);
  assert.equal(s.description, 'Opis katalogowy Delahaze.');
  assert.equal(s.description_auto, true);
  assert.deepEqual(s.sources, [{ title: 'Źródło A', url: 'https://example.com/a' }]);
  const [e] = await edits(id);
  assert.equal(e.user_id, null);
  assert.equal(e.actor, ENRICH_ACTOR);
  assert.deepEqual(Object.keys(e.changes).sort(), ['description', 'description_auto', 'sources', 'taste', 'terpenes']);
  const h = await listHistory(id, uid);
  assert.equal(h[0].who, 'Zielnik (katalog)');
});

test('ponowne uruchomienie nie dodaje wpisów historii', { skip }, async () => {
  const id = await add('Aurora', 'Delahaze 22');
  await enrichStrains(CATALOG);
  const n = (await edits(id)).length;
  const r = await enrichStrains(CATALOG);
  assert.equal((await edits(id)).length, n);
  assert.equal(r.updated, 0);
});

test('dane wpisane przez użytkownika nie są nadpisywane (smak, terpeny, opis osobno)', { skip }, async () => {
  const a = await add('Cosma', 'Black R', { taste: 'mój smak' });
  const b = await add('cosma s.a.', 'BLACK R', { terpenes: ['Pinen'] });
  const c = await add('Cosma', 'Black  R', { description: 'mój opis' });
  await enrichStrains(CATALOG);
  const sa = await get(a), sb = await get(b), sc = await get(c);
  assert.equal(sa.taste, 'mój smak'); assert.deepEqual(sa.terpenes, ['Kariofilen']); assert.equal(sa.description, 'Opis Black R.');
  assert.equal(sb.taste, 'ziemisty'); assert.deepEqual(sb.terpenes, ['Pinen']); assert.equal(sb.description, 'Opis Black R.');
  assert.equal(sc.taste, 'ziemisty'); assert.deepEqual(sc.terpenes, ['Kariofilen']); assert.equal(sc.description, 'mój opis');
  assert.equal(sc.description_auto, false, 'własny opis nie jest oznaczany jako automatyczny');
  assert.deepEqual(sc.sources, [], 'źródła tylko przy uzupełnianiu opisu');
  const ec = await edits(c);
  assert.deepEqual(Object.keys(ec[0].changes).sort(), ['taste', 'terpenes']);
});

test('odmiana bez dopasowania lub z samym podobnym THC nie jest ruszana; niejednoznaczne są pomijane', { skip }, async () => {
  const none = await add('Aurora', 'Nieznana');
  const other = await add('Tilray', 'Delahaze');
  const amb = await add('Aurora', 'Wspólna');
  const r = await enrichStrains(CATALOG);
  for (const id of [none, other, amb]) {
    assert.deepEqual(await get(id), { taste: '', terpenes: [], description: '', description_auto: false, sources: [] });
    assert.equal((await edits(id)).length, 0);
  }
  assert.ok(r.ambiguous.includes('Aurora Wspólna'));
  assert.ok(r.unmatched >= 2);
});
