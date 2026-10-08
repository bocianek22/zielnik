// Usunięcie konta (DELETE /api/account) w jednej transakcji: albo znika wszystko, albo nic.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setup, skip } from './harness.mjs';

let h;
const PASS = 'haslo-usera-1';
before(async () => {
  if (skip) return;
  h = await setup(['ania', 'bartek', 'celina']);
  const hash = await bcrypt.hash(PASS, 4);
  await h.q`UPDATE users SET password_hash = ${hash}`;
});
after(async () => { if (h) await h.pool.end(); });

async function seed(owner, other) {
  const { q } = h;
  await q`DELETE FROM strains`;
  const [s] = await q`INSERT INTO strains (name, producer, type, created_by) VALUES ('Moja', 'P', 'haze', ${owner}) RETURNING id`;
  await q`INSERT INTO strain_tests (strain_id, user_id, note) VALUES (${s.id}, ${owner}, 'a1'), (${s.id}, ${owner}, 'a2'), (${s.id}, ${other}, 'b1')`;
  await q`INSERT INTO user_strain (user_id, strain_id, rating) VALUES (${owner}, ${s.id}, 7)`;
  await q`DELETE FROM rate_limits`;
  return s.id;
}

test('usunięcie konta: konto, testy i dane osobiste znikają, wspólna odmiana zostaje bez autora, cudze testy nietknięte', { skip }, async () => {
  const { q, ids, call } = h;
  const sid = await seed(ids.ania, ids.bartek);
  const r = await call(ids.ania, 'account', 'DELETE', { password: PASS });
  assert.equal(r.status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${ids.ania}`)[0].n, 0);
  assert.equal((await q`SELECT count(*)::int AS n FROM strain_tests WHERE strain_id = ${sid}`)[0].n, 1);
  assert.equal((await q`SELECT count(*)::int AS n FROM user_strain WHERE strain_id = ${sid}`)[0].n, 0);
  const [s] = await q`SELECT created_by FROM strains WHERE id = ${sid}`;
  assert.equal(s.created_by, null);
});

test('niepowodzenie ostatniego kroku wycofuje całość (konto, testy i autorstwo odmian zostają)', { skip }, async () => {
  const { q, ids, call } = h;
  const sid = await seed(ids.bartek, ids.celina);
  // wyzwalacz wymusza błąd przy DELETE FROM users, już po skasowaniu testów i zdjęciu autorstwa odmian
  await q`CREATE OR REPLACE FUNCTION blokuj_usuniecie() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test: usunięcie zablokowane'; END $$ LANGUAGE plpgsql`;
  await q`CREATE TRIGGER blokuj BEFORE DELETE ON users FOR EACH ROW WHEN (OLD.username = 'bartek') EXECUTE FUNCTION blokuj_usuniecie()`;
  try {
    const r = await call(ids.bartek, 'account', 'DELETE', { password: PASS });
    assert.equal(r.status, 500);
    assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${ids.bartek}`)[0].n, 1, 'konto zostaje');
    assert.equal((await q`SELECT count(*)::int AS n FROM strain_tests WHERE user_id = ${ids.bartek}`)[0].n, 2, 'testy zostają');
    assert.equal((await q`SELECT created_by FROM strains WHERE id = ${sid}`)[0].created_by, ids.bartek, 'autorstwo odmiany zostaje');
  } finally {
    await q`DROP TRIGGER IF EXISTS blokuj ON users`;
    await q`DROP FUNCTION IF EXISTS blokuj_usuniecie()`;
  }
  // po usunięciu przeszkody to samo żądanie przechodzi
  await q`DELETE FROM rate_limits`;
  assert.equal((await call(ids.bartek, 'account', 'DELETE', { password: PASS })).status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM users WHERE id = ${ids.bartek}`)[0].n, 0);
});
