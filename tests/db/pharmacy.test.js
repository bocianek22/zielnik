// POM-37 karta „W aptece” (lib/stats.js pharmacyPools): jedna pozycja na pulę z „do wykupienia” > 0, nazwy pozostałych
// odmian puli, mój stan; tylko moje pule.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, stats;
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
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = u.id;
  }
  const mk = async (key, producer, name, thc, form, ago) => {
    const [r] = await q`INSERT INTO strains (producer, name, type, thc, cbd, form, created_by, created_at)
      VALUES (${producer}, ${name}, 'haze', ${thc}, 0, ${form}, ${ids.ania}, now() - ${ago}::int * interval '1 day') RETURNING id`;
    S[key] = r.id;
  };
  await mk('a', 'Aurora', 'Lemon', 20, 'susz', 3);
  await mk('b', 'Aurora', 'Lemon 2', 20, 'susz', 1); // ta sama pula co „a”, nowsza
  await mk('c', 'Tilray', 'Bediol', 6, 'susz', 2);
  await mk('d', 'Medalchemy', 'Olej', 10, 'olej', 2);
});

after(async () => { if (pool) await pool.end(); });

const pk = async (id) => (await q`SELECT pool_key(id, producer, thc, cbd, form) AS k FROM strains WHERE id = ${id}`)[0].k;

test('jedna pozycja na pulę (najnowsza odmiana), pozostałe nazwy, mój stan; pule z zerem pominięte; cudze niewidoczne', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${S.b}, ${A}, 1.5), (${S.d}, ${A}, 4)`;
  await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy) VALUES
    (${A}, ${await pk(S.a)}, 7), (${A}, ${await pk(S.c)}, 0), (${A}, ${await pk(S.d)}, 30), (${B}, ${await pk(S.c)}, 9)`;
  const rows = await stats.pharmacyPools(A);
  assert.deepEqual(rows.map((r) => [r.name, r.unit, r.remaining, r.current]), [['Lemon 2', 'g', 7, 1.5], ['Olej', 'ml', 30, 4]]);
  assert.deepEqual(rows[0].mates, ['Lemon']);
  assert.deepEqual(rows[1].mates, []);
  const rb = await stats.pharmacyPools(B);
  assert.deepEqual(rb.map((r) => [r.name, r.remaining, r.current]), [['Bediol', 9, 0]]);
});
