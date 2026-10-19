// 1.1.0: szyfrowanie punktów „Do omówienia” (doctor_notes.text) i innych leków (other_meds.name, dose): szyfrogram w bazie,
// jawny tekst w API, eksporcie, wyszukiwarce i imporcie; dłuższy szyfrogram mieści się po zamianie CHECK; brak klucza daje
// znacznik; skrypt encrypt-notes przepisuje stare jawne wiersze. Test sam ustawia DATA_ENCRYPTION_KEY.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const K1 = `k1:${randomBytes(32).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
const setKey = (v) => { if (v == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = v; };

let q, jar, pool, createSession, importBackup, searchNotes, LOCKED_NOTE;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  return { status: res.status, json: (res.headers.get('content-type') || '').includes('json') ? await res.json() : null };
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
  ({ importBackup } = await import('../../lib/import-backup-db.js'));
  ({ searchNotes } = await import('../../lib/notes-search.js'));
  ({ LOCKED_NOTE } = await import('../../lib/data-crypto.js'));
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  setKey(K1);
});

after(async () => { setKey(savedKey); if (pool) await pool.end(); });

test('schemat: stare CHECK zamienione na luźniejsze, ponowna migracja nic nie psuje', { skip }, async () => {
  const names = async () => (await q`SELECT conname FROM pg_constraint WHERE conrelid IN ('doctor_notes'::regclass, 'other_meds'::regclass) AND contype = 'c' ORDER BY conname`).map((r) => r.conname);
  assert.deepEqual(await names(), ['doctor_notes_text_len', 'other_meds_dose_len', 'other_meds_name_len']);
  // pełne init() drugi raz (jak po zmianie sumy schematu)
  await q`UPDATE schema_meta SET value = 'stara' WHERE key = 'schema'`;
  const db = await import(`../../lib/db.js?again=${Date.now()}`);
  await db.ensureDb();
  assert.deepEqual(await names(), ['doctor_notes_text_len', 'other_meds_dose_len', 'other_meds_name_len']);
  // pusta nazwa nadal odrzucana przez bazę
  await assert.rejects(q`INSERT INTO other_meds (user_id, name) VALUES (${ids.ania}, '')`);
});

test('zapis szyfruje (także 200 znaków z polskimi literami), API i raport widzą tekst, długość pilnuje kod', { skip }, async () => {
  const A = ids.ania;
  const long = 'ż'.repeat(200);
  assert.equal((await call(A, 'doctor-notes', 'POST', { text: long })).status, 200);
  assert.equal((await call(A, 'doctor-notes', 'POST', { text: 'ż'.repeat(201) })).status, 400);
  const r = await call(A, 'doctor-notes', 'POST', { text: 'zapytać o dawkę wieczorną' });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.notes.map((n) => n.text), [long, 'zapytać o dawkę wieczorną']);
  assert.equal((await call(A, 'doctor-notes', 'POST', { text: LOCKED_NOTE })).status, 400, 'znacznik to nie treść');

  const m = await call(A, 'other-meds', 'POST', { name: 'Ibuprofen', dose: '200 mg wieczorem' });
  assert.equal(m.status, 200);
  await call(A, 'other-meds', 'POST', { name: 'ł'.repeat(80), dose: '' });
  assert.equal((await call(A, 'other-meds', 'POST', { name: 'ł'.repeat(81) })).status, 400);
  assert.deepEqual((await call(A, 'other-meds', 'GET')).json.meds.map(({ name, dose }) => [name, dose]),
    [['Ibuprofen', '200 mg wieczorem'], ['ł'.repeat(80), '']]);

  const notes = await q`SELECT text FROM doctor_notes WHERE user_id = ${A}`;
  assert.ok(notes.every((n) => n.text.startsWith('zenc1:k1:')), 'w bazie tylko szyfrogramy');
  const meds = await q`SELECT name, dose FROM other_meds WHERE user_id = ${A} ORDER BY id`;
  assert.ok(meds.every((x) => x.name.startsWith('zenc1:k1:')));
  assert.ok(meds[0].dose.startsWith('zenc1:k1:'));
  assert.equal(meds[1].dose, '', 'pusta dawka zostaje pusta');
  assert.ok(!JSON.stringify([notes, meds]).includes('Ibuprofen'));

  // szyfrogramu nie da się przenieść do innego wiersza (AAD: konto + id)
  const [a, b] = await q`SELECT id, name FROM other_meds WHERE user_id = ${A} ORDER BY id`;
  await q`UPDATE other_meds SET name = ${a.name} WHERE id = ${b.id}`;
  assert.equal((await call(A, 'other-meds', 'GET')).json.meds[1].name, LOCKED_NOTE);
  await q`UPDATE other_meds SET name = ${b.name} WHERE id = ${b.id}`;
});

test('eksport, wyszukiwarka i import z pliku pracują na jawnym tekście', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const j = (await call(A, 'account/export', 'GET')).json;
  assert.deepEqual(j.doctorNotes.map((n) => n.text), ['ż'.repeat(200), 'zapytać o dawkę wieczorną']);
  assert.deepEqual(j.otherMeds.map((x) => x.name), ['Ibuprofen', 'ł'.repeat(80)]);
  assert.ok(!('id' in j.otherMeds[0]) && !('id' in j.doctorNotes[0]));
  assert.ok((await searchNotes(A, 'wieczorną')).some((x) => x.kind === 'doctor'));

  // import pliku Ani do Bartka: szyfrowane z zakresem Bartka; drugi import nie dubluje (porównanie po odszyfrowaniu)
  const file = { exportedAt: new Date().toISOString(), doctorNotes: j.doctorNotes, otherMeds: [...j.otherMeds, { name: LOCKED_NOTE }] };
  const r1 = await importBackup(B, file);
  assert.equal(r1.error, undefined);
  const sec = Object.fromEntries(r1.sections.map((s) => [s.key, s]));
  assert.equal(sec.otherMeds.added, 2);
  assert.equal(sec.otherMeds.invalid, 1, 'znacznik z eksportu bez klucza pominięty');
  assert.equal(sec.doctorNotes.added, 2);
  assert.ok((await q`SELECT text FROM doctor_notes WHERE user_id = ${B}`).every((n) => n.text.startsWith('zenc1:')));
  assert.deepEqual((await call(B, 'other-meds', 'GET')).json.meds.map((x) => x.name), ['Ibuprofen', 'ł'.repeat(80)]);
  const r2 = await importBackup(B, file);
  const sec2 = Object.fromEntries(r2.sections.map((s) => [s.key, s]));
  assert.equal(sec2.otherMeds.added, 0); assert.equal(sec2.otherMeds.existing, 2);
  assert.equal(sec2.doctorNotes.added, 0); assert.equal(sec2.doctorNotes.existing, 2);
});

test('bez klucza: znacznik zamiast treści, nowe wpisy jawne; encrypt-notes szyfruje stare jawne wiersze (obie kolumny leków)', { skip }, async () => {
  const A = ids.ania;
  setKey(null);
  try {
    assert.ok((await call(A, 'other-meds', 'GET')).json.meds.every((x) => x.name === LOCKED_NOTE));
    assert.ok((await call(A, 'doctor-notes', 'GET')).json.notes.every((x) => x.text === LOCKED_NOTE));
    await call(A, 'other-meds', 'POST', { name: 'Paracetamol', dose: '500 mg' });
    const [plain] = await q`SELECT name, dose FROM other_meds WHERE user_id = ${A} ORDER BY id DESC LIMIT 1`;
    assert.deepEqual(plain, { name: 'Paracetamol', dose: '500 mg' });
  } finally { setKey(K1); }
  const { run } = await import('../../scripts/encrypt-notes.mjs');
  const sql = { query: async (t, p) => (await pool.query(t, p)).rows };
  const res = await run(sql, { table: 'other_meds' });
  assert.equal(res.failed, 0);
  assert.equal(res.byTable['other_meds.name'].changed, 1);
  assert.equal(res.byTable['other_meds.dose'].changed, 1);
  const [enc] = await q`SELECT name, dose FROM other_meds WHERE user_id = ${A} ORDER BY id DESC LIMIT 1`;
  assert.ok(enc.name.startsWith('zenc1:') && enc.dose.startsWith('zenc1:'));
  assert.equal((await call(A, 'other-meds', 'GET')).json.meds.at(-1).dose, '500 mg');
  assert.equal((await run(sql, { table: 'other_meds' })).changed, 0, 'drugi przebieg nic nie zmienia');
});
