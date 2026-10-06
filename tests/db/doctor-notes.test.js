// POM-36 „Do omówienia z lekarzem”: dodawanie (limit 10 nieomówionych, długość), odhaczanie, usuwanie, cudze 404,
// eksport, kopia, usunięcie konta.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, backup;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, json: type.includes('json') ? await res.json() : null, text: type.includes('csv') ? await res.text() : null };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  backup = await import('../../lib/backup.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
});

after(async () => { if (pool) await pool.end(); });

test('dodawanie: tekst wymagany, do 200 znaków, najwyżej 10 nieomówionych; odhaczony zwalnia miejsce', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(null, 'doctor-notes', 'GET')).status, 401);
  assert.equal((await call(A, 'doctor-notes', 'POST', { text: '   ' })).status, 400);
  assert.equal((await call(A, 'doctor-notes', 'POST', { text: 'x'.repeat(201) })).status, 400);
  for (let i = 1; i <= 10; i++) assert.equal((await call(A, 'doctor-notes', 'POST', { text: `Pytanie ${i}\n` })).status, 200);
  const full = await call(A, 'doctor-notes', 'POST', { text: 'jedenaste' });
  assert.equal(full.status, 409);
  const { notes } = (await call(A, 'doctor-notes', 'GET')).json;
  assert.equal(notes.length, 10);
  assert.equal(notes[0].text, 'Pytanie 1');
  assert.equal((await call(A, 'doctor-notes/[id]', 'PATCH', { done: true }, { id: String(notes[0].id) })).status, 200);
  assert.equal((await call(A, 'doctor-notes', 'POST', { text: 'jedenaste' })).status, 200);
});

test('cudzy punkt: odhaczenie i usunięcie dają 404, lista nie pokazuje cudzych', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const [n] = await q`SELECT id FROM doctor_notes WHERE user_id = ${A} LIMIT 1`;
  assert.equal((await call(B, 'doctor-notes/[id]', 'PATCH', { done: true }, { id: String(n.id) })).status, 404);
  assert.equal((await call(B, 'doctor-notes/[id]', 'DELETE', null, { id: String(n.id) })).status, 404);
  assert.equal((await call(B, 'doctor-notes', 'GET')).json.notes.length, 0);
  assert.equal((await call(A, 'doctor-notes/[id]', 'DELETE', null, { id: String(n.id) })).status, 200);
  assert.equal((await call(A, 'doctor-notes/[id]', 'PATCH', { done: 'tak' }, { id: String(n.id) })).status, 400);
});

test('eksport, kopia, usunięcie konta', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  await call(B, 'doctor-notes', 'POST', { text: 'Bartka' });
  const j = (await call(A, 'account/export', 'GET')).json;
  assert.equal(j.doctorNotes.length, 10);
  assert.ok(!j.doctorNotes.some((n) => n.text === 'Bartka'));
  const b = await backup.buildBackup();
  assert.ok(b.doctor_notes.some((n) => n.user_id === B));
  await q`DELETE FROM users WHERE id = ${B}`;
  assert.equal((await q`SELECT 1 FROM doctor_notes WHERE user_id = ${B}`).length, 0);
});
