// Pobranie kopii przez admina (POST /api/backup) wymaga ponownego podania hasła; GET nie wydaje już zrzutu; limit prób.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { setup, skip } from './harness.mjs';

let h;
const PASS = 'haslo-admina-1';
before(async () => {
  if (skip) return;
  h = await setup(['szef', 'ania']);
  await h.q`UPDATE users SET is_admin = TRUE, password_hash = ${await bcrypt.hash(PASS, 4)} WHERE id = ${h.ids.szef}`;
  await h.q`INSERT INTO backups (kind, size, data) VALUES ('reczna', 10, '{"snap":1}')`;
});
after(async () => { if (h) await h.pool.end(); });

test('bez hasła i ze złym hasłem: 403, a plik nie jest wydawany', { skip }, async () => {
  const { q, ids, call } = h;
  await q`DELETE FROM rate_limits`;
  const [b] = await q`SELECT id FROM backups LIMIT 1`;
  for (const body of [{}, { id: b.id }, { id: b.id, password: 'zle' }, { password: '' }]) {
    const r = await call(ids.szef, 'backup', 'POST', body);
    assert.equal(r.status, 403, JSON.stringify(body));
    assert.match(r.json.error, /Nieprawidłowe hasło/);
  }
});

test('poprawne hasło: świeży zrzut i zapisana migawka', { skip }, async () => {
  const { q, ids, call } = h;
  await q`DELETE FROM rate_limits`;
  const [b] = await q`SELECT id FROM backups LIMIT 1`;
  const snap = await call(ids.szef, 'backup', 'POST', { id: b.id, password: PASS });
  assert.equal(snap.status, 200);
  assert.match(snap.res.headers.get('content-disposition'), /zielnik-kopia-\d{4}-\d{2}-\d{2}\.json/);
  assert.deepEqual(snap.json, { snap: 1 });
  const fresh = await call(ids.szef, 'backup', 'POST', { password: PASS });
  assert.equal(fresh.status, 200);
  assert.ok(Object.keys(fresh.json).length > 0);
  assert.equal((await call(ids.szef, 'backup', 'POST', { id: 999999, password: PASS })).status, 404);
});

test('GET nie wydaje kopii (405), nawet dla admina z ważną sesją', { skip }, async () => {
  const r = await h.call(h.ids.szef, 'backup', 'GET');
  assert.equal(r.status, 405);
  assert.doesNotMatch(r.text ?? JSON.stringify(r.json), /snap/);
});

test('nie-admin dostaje 403 także z hasłem admina, niezalogowany 401', { skip }, async () => {
  assert.equal((await h.call(h.ids.ania, 'backup', 'POST', { password: PASS })).status, 403);
  assert.equal((await h.call(null, 'backup', 'POST', { password: PASS })).status, 401);
});

test('limit prób: po 5 błędnych hasłach nawet dobre jest odrzucone (429), udane pobranie zeruje licznik', { skip }, async () => {
  const { q, ids, call } = h;
  await q`DELETE FROM rate_limits`;
  for (let i = 0; i < 5; i++) assert.equal((await call(ids.szef, 'backup', 'POST', { password: `zle${i}` })).status, 403);
  const r = await call(ids.szef, 'backup', 'POST', { password: PASS });
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Zbyt wiele prób/);
  await q`DELETE FROM rate_limits`;
  for (let i = 0; i < 4; i++) await call(ids.szef, 'backup', 'POST', { password: 'zle' });
  assert.equal((await call(ids.szef, 'backup', 'POST', { password: PASS })).status, 200);
  for (let i = 0; i < 4; i++) assert.equal((await call(ids.szef, 'backup', 'POST', { password: 'zle' })).status, 403);
});
