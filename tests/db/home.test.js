// Ekran główny (lib/stats.js homeSummary): lekkie dane panelu „Dziś” muszą dawać te same sumy, co liczenie z pełnej listy odmian.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, stats, strains;
const ids = {};
const S = {};

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  stats = await import('../../lib/stats.js');
  strains = await import('../../lib/strains.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = u.id;
  }
  const mk = async (key, producer, name, thc, form) => {
    const [r] = await q`INSERT INTO strains (producer, name, type, thc, cbd, form, created_by) VALUES (${producer}, ${name}, 'haze', ${thc}, 0, ${form}, ${ids.ania}) RETURNING id`;
    S[key] = r.id;
  };
  await mk('a', 'Aurora', 'Lemon', 20, 'susz');
  await mk('b', 'Aurora', 'Lemon 2', 20, 'susz');   // ta sama pula co „a”
  await mk('c', 'Tilray', 'Bediol', 6, 'susz');
  await mk('d', 'Medalchemy', 'Olej', 10, 'olej');
  await mk('e', 'Inna', 'Cudza', 5, 'susz');        // bez wpisu Ani
});

after(async () => { if (pool) await pool.end(); });

test('homeSummary: zapas, „do wykupienia” (pula raz), liczba odmian i ostatnie odmiany zgodne z listą', { skip }, async () => {
  const A = ids.ania;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${S.a}, ${A}, 2.5), (${S.b}, ${A}, 1), (${S.c}, ${A}, 0), (${S.d}, ${A}, 12)`;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${S.a}, ${ids.bartek}, 99)`;
  const poolKey = async (id) => (await q`SELECT pool_key(id, producer, thc, cbd, form) AS k FROM strains WHERE id = ${id}`)[0].k;
  await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy) VALUES (${A}, ${await poolKey(S.a)}, 7), (${A}, ${await poolKey(S.d)}, 30), (${A}, 'nieistniejąca', 500)`;
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${A}, ${S.c}, 0.5, now() - interval '2 hours'), (${A}, ${S.a}, 0.5, now() - interval '1 hour'), (${A}, ${S.c}, 0.5, now() - interval '3 hours')`;

  const h = await stats.homeSummary(A);
  assert.equal(h.count, 5);
  assert.equal(h.mine, 4); // POM-20: tylko odmiany z moim wpisem (count to wszystkie w bazie)
  assert.deepEqual(h.stock, { g: 3.5, ml: 12 });
  assert.deepEqual(h.remaining, { g: 7, ml: 30 });
  assert.deepEqual(h.recent.map((r) => r.id), [S.a, S.c]);
  assert.deepEqual(h.recent.map((r) => r.current), [2.5, 0]);
  assert.equal(h.recent[0].name, 'Lemon');

  // te same sumy z pełnej listy (jak liczył to StrainsBoard)
  const list = await strains.listStrains(A);
  const mine = (s) => s.entries.find((e) => e.userId === A);
  const stockG = list.filter((s) => s.form === 'susz').reduce((a, s) => a + Number(mine(s).current), 0);
  assert.equal(h.stock.g, stockG);
  const pools = new Map();
  list.forEach((s) => pools.set(s.pool_key, pools.get(s.pool_key) || s));
  assert.equal(h.remaining.g, [...pools.values()].filter((s) => s.form === 'susz').reduce((a, s) => a + Number(mine(s).remaining), 0));

  // inny użytkownik: bez cudzych stanów i „do wykupienia”
  const b = await stats.homeSummary(ids.bartek);
  assert.deepEqual(b.stock, { g: 99, ml: 0 });
  assert.deepEqual(b.remaining, { g: 0, ml: 0 });
  assert.deepEqual(b.recent, []);
  assert.equal(b.mine, 1);
});
