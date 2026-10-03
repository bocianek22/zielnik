// Spis wyszukiwarki (lib/search.js): odmiany, tylko aktywny katalog, tylko grupy z aktywnym członkostwem.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, searchIndex;
const ids = {};

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ searchIndex } = await import('../../lib/search.js'));
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [r] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = r.id;
  }
});

after(async () => { if (pool) await pool.end(); });

test('searchIndex: odmiany, aktywny katalog i tylko moje aktywne grupy', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  await q`INSERT INTO strains (producer, name, type, taste, terpenes, created_by)
    VALUES ('Łódzkie Zioła', 'Żółw Ninja', 'x', 'ziołowy', '["Mircen"]'::jsonb, ${B})`;
  await q`INSERT INTO market_catalog (producer, name, source, active) VALUES ('Aurora', 'Zorza', 't', true), ('Aurora', 'Stara', 't', false)`;
  const [g1] = await q`INSERT INTO groups (name, owner_id) VALUES ('Moja', ${A}) RETURNING id`;
  const [g2] = await q`INSERT INTO groups (name, owner_id) VALUES ('Zaproszenie', ${B}) RETURNING id`;
  const [g3] = await q`INSERT INTO groups (name, owner_id) VALUES ('Cudza', ${B}) RETURNING id`;
  await q`INSERT INTO group_members (group_id, user_id, status) VALUES (${g1.id}, ${A}, 'active'), (${g2.id}, ${A}, 'invited'), (${g3.id}, ${B}, 'active')`;

  const a = await searchIndex(A);
  assert.deepEqual(a.strains.map((s) => [s.name, s.producer, s.taste]), [['Żółw Ninja', 'Łódzkie Zioła', 'ziołowy']]);
  assert.deepEqual(a.strains[0].terpenes, ['Mircen']);
  assert.deepEqual(a.catalog.map((c) => c.name), ['Zorza']);
  assert.deepEqual(a.groups.map((g) => g.name), ['Moja']);
  const b = await searchIndex(B);
  assert.deepEqual(b.groups.map((g) => g.name), ['Cudza']);
});
