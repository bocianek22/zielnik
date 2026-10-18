// Inne przyjmowane leki (lib/other-meds.js): dodawanie (nazwa wymagana, długość, limit 15), usuwanie, cudze 404,
// eksport, kopia, import z pliku eksportu, usunięcie konta.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, backup, importBackup;
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
  ({ importBackup } = await import('../../lib/import-backup-db.js'));
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
});

after(async () => { if (pool) await pool.end(); });

test('dodawanie: nazwa wymagana, do 80 znaków, najwyżej 15; usuwanie tylko własnych', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  assert.equal((await call(null, 'other-meds', 'GET')).status, 401);
  assert.equal((await call(A, 'other-meds', 'POST', { name: '   ', dose: '1 tabl.' })).status, 400);
  assert.equal((await call(A, 'other-meds', 'POST', { name: 'x'.repeat(81) })).status, 400);
  assert.equal((await call(A, 'other-meds', 'POST', { name: 'Lek', dose: 'd'.repeat(81) })).status, 400);
  const r = await call(A, 'other-meds', 'POST', { name: ' Ibuprofen\n', dose: '200  mg wieczorem' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.meds.map(({ name, dose }) => ({ name, dose })), [{ name: 'Ibuprofen', dose: '200 mg wieczorem' }]);
  for (let i = 2; i <= 15; i++) assert.equal((await call(A, 'other-meds', 'POST', { name: `Lek ${i}` })).status, 200);
  assert.equal((await call(A, 'other-meds', 'POST', { name: 'szesnasty' })).status, 409);
  const [m] = await q`SELECT id FROM other_meds WHERE user_id = ${A} ORDER BY id LIMIT 1`;
  assert.equal((await call(B, 'other-meds/[id]', 'DELETE', null, { id: String(m.id) })).status, 404);
  assert.equal((await call(B, 'other-meds', 'GET')).json.meds.length, 0);
  assert.equal((await call(A, 'other-meds/[id]', 'DELETE', null, { id: String(m.id) })).status, 200);
  assert.equal((await call(A, 'other-meds/[id]', 'DELETE', null, { id: 'abc' })).status, 404);
  assert.equal((await call(A, 'other-meds', 'GET')).json.meds.length, 14);
});

test('eksport, import z pliku eksportu (bez powtórzeń, z limitem), kopia, usunięcie konta', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  await call(B, 'other-meds', 'POST', { name: 'Bartka' });
  await call(B, 'other-meds', 'POST', { name: 'Lek 3' }); // ten sam co w pliku: „istniejący”, nie dubel
  await call(B, 'other-meds', 'POST', { name: 'Własny' });
  const j = (await call(A, 'account/export', 'GET')).json;
  assert.equal(j.otherMeds.length, 14);
  assert.ok(!j.otherMeds.some((m) => m.name === 'Bartka'));
  // plik eksportu Ani wgrany na konto Bartka
  const file = { exportedAt: new Date().toISOString(), otherMeds: [...j.otherMeds, { name: 'lek 2' }, { name: '' }, { name: 'Nowy', dose: 'x'.repeat(81) }] };
  const r = await importBackup(B, file);
  assert.equal(r.error, undefined);
  const sec = Object.fromEntries((r.sections || []).map((s) => [s.key, s]));
  const meds = await q`SELECT name FROM other_meds WHERE user_id = ${B} ORDER BY id`;
  // 3 własne + 12 z pliku = 15: „Lek 3” już jest, „lek 2” to powtórka w pliku, ostatni nowy nie mieści się w limicie
  assert.equal(meds.length, 15, JSON.stringify(sec.otherMeds || r));
  assert.equal(sec.otherMeds.added, 12); assert.equal(sec.otherMeds.existing, 1);
  assert.equal(sec.otherMeds.limit, 1); assert.equal(sec.otherMeds.invalid, 2);
  // ponowny import nic nie dodaje
  await importBackup(B, file);
  assert.equal((await q`SELECT count(*)::int AS n FROM other_meds WHERE user_id = ${B}`)[0].n, 15);
  const b = await backup.buildBackup();
  assert.ok(b.other_meds.some((m) => m.user_id === B));
  await q`DELETE FROM users WHERE id = ${B}`;
  assert.equal((await q`SELECT 1 FROM other_meds WHERE user_id = ${B}`).length, 0);
});
