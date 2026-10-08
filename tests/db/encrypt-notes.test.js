// POM-28: skrypt przepisujący notatki (scripts/encrypt-notes.mjs): szyfrowanie, idempotencja, rotacja, wyścig z edycją, --decrypt.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const K1 = `k1:${randomBytes(32).toString('base64')}`, K2 = `k2:${randomBytes(32).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
const setKey = (v) => { if (v == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = v; };

let q, pool, run, dc, sql;
const ids = {};
let strain, testId;

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  await db.ensureDb();
  q = db.sql();
  dc = await import('../../lib/data-crypto.js');
  ({ run } = await import('../../scripts/encrypt-notes.mjs'));
  sql = { query: async (t, p) => (await pool.query(t, p)).rows };
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  [{ id: strain }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Lemon', 'haze', ${ids.ania}) RETURNING id`;
  setKey(null); // dane „sprzed włączenia”: jawne
  for (const u of [ids.ania, ids.bartek]) {
    await q`INSERT INTO symptom_log (user_id, day, pain, note) VALUES (${u}, '2026-09-01', 3, ${`objaw ${u}`}), (${u}, '2026-09-02', 4, '')`;
    await q`INSERT INTO user_strain (strain_id, user_id, notes) VALUES (${strain}, ${u}, ${`wpis ${u}`})`;
    await q`INSERT INTO prescriptions (user_id, issued_on, grams, note) VALUES (${u}, '2026-09-01', 10, ${`recepta ${u}`})`;
  }
  [{ id: testId }] = await q`INSERT INTO strain_tests (strain_id, user_id, note) VALUES (${strain}, ${ids.ania}, 'test ania') RETURNING id`;
});

after(async () => { setKey(savedKey); if (pool) await pool.end(); });

const plain = () => q`SELECT (SELECT count(*)::int FROM symptom_log WHERE note NOT LIKE 'zenc1:%' AND note <> '') +
  (SELECT count(*)::int FROM user_strain WHERE notes NOT LIKE 'zenc1:%' AND notes <> '') +
  (SELECT count(*)::int FROM prescriptions WHERE note NOT LIKE 'zenc1:%' AND note <> '') +
  (SELECT count(*)::int FROM strain_tests WHERE note NOT LIKE 'zenc1:%' AND note <> '') AS n`.then((r) => r[0].n);

test('bez klucza skrypt odmawia, --dry-run niczego nie zmienia', { skip }, async () => {
  await assert.rejects(run(sql, {}), /Brak DATA_ENCRYPTION_KEY/);
  setKey(K1);
  const d = await run(sql, { dry: true });
  assert.equal(d.changed, 7);
  assert.equal(await plain(), 7);
  await assert.rejects(run(sql, { table: 'nie_ma' }), /Nieznana tabela/);
});

test('szyfrowanie: wszystkie jawne niepuste wiersze, małe porcje, pusty zostaje pusty; drugi przebieg 0 zmian', { skip }, async () => {
  setKey(K1);
  const r = await run(sql, { batch: 2 });
  assert.equal(r.changed, 7);
  assert.equal(r.failed, 0);
  assert.equal(await plain(), 0);
  assert.equal((await q`SELECT note FROM symptom_log WHERE day = '2026-09-02' AND user_id = ${ids.ania}`)[0].note, '');
  // odczyt przez moduł zgadza się z AAD (id wiersza dla testu, user_id dla reszty)
  const [t] = await q`SELECT note FROM strain_tests WHERE id = ${testId}`;
  assert.equal(dc.decryptField('strain_tests', 'note', testId, t.note), 'test ania');
  const [s] = await q`SELECT note FROM symptom_log WHERE user_id = ${ids.bartek} AND day = '2026-09-01'`;
  assert.equal(dc.decryptField('symptom_log', 'note', ids.bartek, s.note), `objaw ${ids.bartek}`);
  const again = await run(sql, {});
  assert.equal(again.changed, 0);
  assert.equal(again.skipped, 7);
});

test('rotacja: wiersze ze starym kid dostają nowy; --table ogranicza zakres', { skip }, async () => {
  setKey(`${K2},${K1}`);
  const one = await run(sql, { table: 'prescriptions' });
  assert.equal(one.changed, 2);
  assert.equal((await q`SELECT count(*)::int AS n FROM prescriptions WHERE note LIKE 'zenc1:k2:%'`)[0].n, 2);
  assert.equal((await q`SELECT count(*)::int AS n FROM symptom_log WHERE note LIKE 'zenc1:k2:%'`)[0].n, 0);
  const rest = await run(sql, {});
  assert.equal(rest.changed, 5);
  assert.equal((await q`SELECT count(*)::int AS n FROM user_strain WHERE notes LIKE 'zenc1:k1:%'`)[0].n, 0);
  assert.equal((await run(sql, {})).changed, 0);
  assert.equal(dc.decryptField('prescriptions', 'note', ids.ania, (await q`SELECT note FROM prescriptions WHERE user_id = ${ids.ania}`)[0].note), `recepta ${ids.ania}`);
});

test('równoległa edycja w trakcie przebiegu nie jest nadpisana (UPDATE z warunkiem na starą wartość)', { skip }, async () => {
  setKey(K1);
  await q`UPDATE user_strain SET notes = 'jawna sprzed' WHERE user_id = ${ids.ania}`;
  let raced = false;
  const racing = {
    query: async (text, params) => {
      // tuż przed UPDATE-em użytkownik zapisuje nową notatkę
      if (!raced && text.startsWith('UPDATE user_strain')) {
        raced = true;
        await pool.query(`UPDATE user_strain SET notes = 'edycja w trakcie' WHERE user_id = $1`, [ids.ania]);
      }
      return sql.query(text, params);
    },
  };
  const r = await run(racing, { table: 'user_strain' });
  assert.ok(raced);
  assert.equal(r.raced, 1);
  assert.equal((await q`SELECT notes FROM user_strain WHERE user_id = ${ids.ania}`)[0].notes, 'edycja w trakcie');
  // kolejny przebieg dokończy
  const next = await run(sql, { table: 'user_strain' });
  assert.equal(next.raced, 0);
  assert.equal(dc.decryptField('user_strain', 'notes', ids.ania, (await q`SELECT notes FROM user_strain WHERE user_id = ${ids.ania}`)[0].notes), 'edycja w trakcie');
});

test('--decrypt przywraca jawny tekst, jest idempotentny; błąd wiersza nie przerywa i nie psuje danych', { skip }, async () => {
  setKey(`${K1},${K2}`);
  await run(sql, {}); // wszystko pod K1 (część była pod K2 po rotacji)
  const bad = 'zenc1:k1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  await q`UPDATE symptom_log SET note = ${bad} WHERE user_id = ${ids.bartek} AND day = '2026-09-01'`;
  const d = await run(sql, { decrypt: true });
  assert.equal(d.failed, 1);
  assert.equal(d.changed, 6);
  assert.equal((await q`SELECT note FROM symptom_log WHERE user_id = ${ids.bartek} AND day = '2026-09-01'`)[0].note, bad);
  assert.equal((await q`SELECT notes FROM user_strain WHERE user_id = ${ids.bartek}`)[0].notes, `wpis ${ids.bartek}`);
  assert.equal((await q`SELECT note FROM strain_tests WHERE id = ${testId}`)[0].note, 'test ania');
  assert.equal((await q`SELECT note FROM prescriptions WHERE user_id = ${ids.ania}`)[0].note, `recepta ${ids.ania}`);
  const again = await run(sql, { decrypt: true });
  assert.equal(again.changed, 0);
  assert.equal(again.failed, 1);
});
