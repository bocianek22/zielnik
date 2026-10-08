// POM-28: szyfrowanie notatek w bazie (lib/data-crypto.js): zapisy i odczyty w trasach, widoczność dla znajomych,
// eksport, raport, kopia, brak klucza i rotacja. Test sam ustawia DATA_ENCRYPTION_KEY (i przywraca wartość z otoczenia).
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

let q, jar, pool, createSession, listStrains, listTests, dc, doctorReport, buildBackup;
const ids = {};
let strain;

async function call(uid, route, method, body, params = {}, { text = false, query = '' } = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}${query}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  if (text) return { status: res.status, text: await res.text() };
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

const D = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const TODAY = () => new Date().toISOString().slice(0, 10);

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
  ({ listStrains, listTests } = await import('../../lib/strains.js'));
  ({ doctorReport } = await import('../../lib/report.js'));
  ({ buildBackup } = await import('../../lib/backup.js'));
  dc = await import('../../lib/data-crypto.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek', 'celina']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.ania}, ${ids.bartek}, 'accepted')`;
  [{ id: strain }] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Lemon', 'haze', ${ids.ania}) RETURNING id`;
  setKey(K1);
});

after(async () => { setKey(savedKey); if (pool) await pool.end(); });

const raw = {
  sym: (u) => q`SELECT note FROM symptom_log WHERE user_id = ${u}`.then((r) => r[0]?.note),
  us: (u) => q`SELECT notes FROM user_strain WHERE user_id = ${u} AND strain_id = ${strain}`.then((r) => r[0]?.notes),
  rx: (u) => q`SELECT note FROM prescriptions WHERE user_id = ${u} ORDER BY id DESC`.then((r) => r[0]?.note),
  test: (u) => q`SELECT id, note FROM strain_tests WHERE user_id = ${u} ORDER BY id DESC`.then((r) => r[0]),
};

test('z kluczem: surowy SELECT bez jawnego tekstu, API zwraca jawny (objawy, wpis, recepta, test)', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(A, 'symptoms', 'PUT', { day: TODAY(), pain: 3, note: 'Sekret objawów' })).status, 200);
  assert.equal((await call(A, 'strains/[id]/entry', 'PUT', { rating: 8, notes: 'Sekret wpisu', visibility: 'friends' }, { id: String(strain) })).status, 200);
  assert.equal((await call(A, 'prescriptions', 'POST', { issuedOn: TODAY(), grams: 30, note: 'Sekret recepty' })).status, 200);
  assert.equal((await call(A, 'strains/[id]/tests', 'POST', { note: 'Sekret testu', visibility: 'friends' }, { id: String(strain) })).status, 200);

  const t = await raw.test(A);
  for (const v of [await raw.sym(A), await raw.us(A), await raw.rx(A), t.note]) {
    assert.ok(v.startsWith('zenc1:k1:'), v);
    assert.ok(!/Sekret/.test(v));
  }
  // odpowiedzi PUT/POST i GET: jawny tekst
  const e = await call(A, 'strains/[id]/entry', 'PUT', { rating: 8, notes: 'Sekret wpisu', visibility: 'friends' }, { id: String(strain) });
  assert.equal(e.json.entry.notes, 'Sekret wpisu');
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows[0].note, 'Sekret objawów');
  assert.equal((await call(A, 'prescriptions', 'GET')).json.prescriptions[0].note, 'Sekret recepty');
  assert.equal((await call(A, 'strains/[id]/tests', 'GET', null, { id: String(strain) })).json.tests[0].note, 'Sekret testu');
  assert.equal((await listStrains(A)).find((s) => s.id === strain).entries.find((x) => x.userId === A).notes, 'Sekret wpisu');
});

test('znajomy (can_see) widzi odszyfrowane notatki, obcy nie widzi wcale', { skip }, async () => {
  const B = ids.bartek, C = ids.celina;
  const seen = (await listStrains(B)).find((s) => s.id === strain).entries.find((x) => x.userId === ids.ania);
  assert.equal(seen.notes, 'Sekret wpisu');
  assert.equal((await listTests(strain, B))[0].note, 'Sekret testu');
  assert.equal((await call(B, 'strains/[id]/tests', 'GET', null, { id: String(strain) })).json.tests[0].note, 'Sekret testu');
  assert.ok(!(await listStrains(C)).find((s) => s.id === strain).entries.some((x) => x.userId === ids.ania));
  assert.equal((await listTests(strain, C)).length, 0);
});

test('edycja testu szyfruje ponownie z id wiersza; szyfrogram przeniesiony do innego wiersza jest nieczytelny', { skip }, async () => {
  const A = ids.ania;
  const { id } = await raw.test(A);
  assert.equal((await call(A, 'tests/[tid]', 'PATCH', { note: 'Po edycji', visibility: 'friends' }, { tid: String(id) })).status, 200);
  const after_ = await raw.test(A);
  assert.ok(after_.note.startsWith('zenc1:'));
  assert.equal((await listTests(strain, A))[0].note, 'Po edycji');
  const { id: id2 } = (await q`INSERT INTO strain_tests (strain_id, user_id, note) VALUES (${strain}, ${A}, ${after_.note}) RETURNING id`)[0];
  const moved = (await listTests(strain, A)).find((t) => t.id === id2);
  assert.deepEqual([moved.note, moved.noteLocked], ['', true]); // klient dostaje '' + flagę, nie znacznik
  await q`DELETE FROM strain_tests WHERE id = ${id2}`;
});

test('szyfrogram z konta A wklejony do konta B daje znacznik (AAD)', { skip }, async () => {
  const [{ notes }] = await q`SELECT notes FROM user_strain WHERE user_id = ${ids.ania} AND strain_id = ${strain}`;
  await q`INSERT INTO user_strain (strain_id, user_id, notes, visibility) VALUES (${strain}, ${ids.celina}, ${notes}, 'me')`;
  const mine = (await listStrains(ids.celina)).find((s) => s.id === strain).entries.find((x) => x.userId === ids.celina);
  assert.deepEqual([mine.notes, mine.notesLocked], ['', true]);
  await q`DELETE FROM user_strain WHERE user_id = ${ids.celina}`;
});

test('import CSV szyfruje notatki, eksport JSON i CSV zawsze jawny, raport dla lekarza jawny', { skip }, async () => {
  const A = ids.ania;
  const imp = await call(A, 'import', 'POST', { rows: [{ name: 'Importowana', producer: 'X', type: 'haze', notes: 'Sekret importu', rating: '7' }] });
  assert.equal(imp.status, 200, JSON.stringify(imp.json));
  assert.equal(imp.json.added, 1);
  const [{ notes }] = await q`SELECT notes FROM user_strain WHERE user_id = ${A} AND notes LIKE '%' AND strain_id <> ${strain}`;
  assert.ok(notes.startsWith('zenc1:'));

  const ex = await call(A, 'account/export', 'GET');
  assert.equal(ex.status, 200);
  const s = JSON.stringify(ex.json);
  assert.ok(!s.includes('zenc1:'));
  for (const w of ['Sekret objawów', 'Sekret wpisu', 'Sekret recepty', 'Po edycji', 'Sekret importu']) assert.ok(s.includes(w), w);
  assert.ok(ex.json.tests.every((t) => !('id' in t)));

  const csv = await call(A, 'account/export/csv', 'GET', null, {}, { text: true });
  assert.ok(csv.text.includes('Sekret objawów') && !csv.text.includes('zenc1:'));
  const csv2 = await call(A, 'export', 'GET', null, {}, { text: true });
  assert.ok(csv2.text.includes('Sekret wpisu') && !csv2.text.includes('zenc1:'));

  await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${A}, ${strain}, 0.5)`;
  const rep = await doctorReport(A, TODAY(), TODAY());
  assert.equal(rep.feel.find((f) => f.name === 'Lemon').notes, 'Sekret wpisu');
});

test('kopia zapasowa zawiera szyfrogram, nie jawny tekst', { skip }, async () => {
  const b = JSON.stringify(await buildBackup());
  assert.ok(b.includes('zenc1:k1:'));
  for (const w of ['Sekret objawów', 'Sekret wpisu', 'Sekret recepty', 'Po edycji']) assert.ok(!b.includes(w), w);
});

test('zgłoszony test: admin widzi odszyfrowaną notatkę', { skip }, async () => {
  const { id } = await raw.test(ids.ania);
  const [admin] = await q`SELECT id FROM users WHERE is_admin LIMIT 1`;
  await q`UPDATE users SET must_change_password = false WHERE id = ${admin.id}`;
  await q`INSERT INTO reports (reporter_id, target_user_id, type, ref, reason) VALUES (${ids.bartek}, ${ids.ania}, 'test', ${id}, 'inne')`;
  const r = await call(admin.id, 'admin/reports', 'GET');
  assert.equal(r.json.reports.find((x) => x.ref === id).test_note, 'Po edycji');
});

test('rotacja: nowy klucz na początku szyfruje, stary dalej odszyfrowuje', { skip }, async () => {
  setKey(`${K2},${K1}`);
  const A = ids.ania;
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows[0].note, 'Sekret objawów');
  assert.equal((await call(A, 'symptoms', 'PUT', { day: TODAY(), pain: 3, note: 'Nowy sekret' })).status, 200);
  assert.ok((await raw.sym(A)).startsWith('zenc1:k2:'));
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows[0].note, 'Nowy sekret');
  assert.equal((await listStrains(A)).find((s) => s.id === strain).entries.find((x) => x.userId === A).notes, 'Sekret wpisu');
  setKey(K2); // stary klucz usunięty: wpisy z k1 nieczytelne, z k2 czytelne
  assert.deepEqual((({ notes, notesLocked }) => [notes, notesLocked])((await listStrains(A)).find((s) => s.id === strain).entries.find((x) => x.userId === A)), ['', true]);
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows[0].note, 'Nowy sekret');
  setKey(K1);
});

test('bez klucza: zapis jawny, odczyt działa, szyfrogramy z przeszłości dają znacznik', { skip }, async () => {
  setKey(null);
  const A = ids.ania;
  assert.equal((await call(A, 'symptoms', 'PUT', { day: TODAY(), pain: 4, note: 'Jawna notatka' })).status, 200);
  assert.equal(await raw.sym(A), 'Jawna notatka');
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows[0].note, 'Jawna notatka');
  assert.equal((await call(A, 'prescriptions', 'GET')).json.prescriptions[0].note, dc.LOCKED_NOTE);
  assert.equal((await call(A, 'strains/[id]/entry', 'PUT', { rating: 8, notes: 'Jawny wpis' }, { id: String(strain) })).json.entry.notes, 'Jawny wpis');
  assert.equal(await raw.us(A), 'Jawny wpis');
  // eksport bez klucza nie zawiera surowego szyfrogramu zamiast treści, tylko znacznik
  const ex = await call(A, 'account/export', 'GET');
  assert.ok(ex.json.prescriptions[0].note === dc.LOCKED_NOTE);
  setKey(K1);
});

test('zły format klucza: liczby zapisane, notatka bez zmian + noteError (200, nie 5xx); nowe teksty i recepty 422; import pomija wiersz', { skip }, async () => {
  const A = ids.ania;
  const day = TODAY();
  await q`DELETE FROM symptom_log WHERE user_id = ${A}`;
  assert.equal((await call(A, 'symptoms', 'PUT', { day, pain: 2, note: 'Przed awarią' })).status, 200);
  setKey('zly-format');
  const r = await call(A, 'symptoms', 'PUT', { day, pain: 9, note: 'x' });
  assert.equal(r.status, 200); // kolejka offline nie utknie na 5xx
  assert.match(r.json.noteError, /Zapis notatki jest chwilowo niedostępny/);
  const row = r.json.rows.find((x) => x.day === day);
  assert.deepEqual([row.pain, row.note, row.noteLocked], [9, '', true]); // liczby zapisane, szyfrogram nietknięty (nieczytelny przy złym kluczu)
  assert.ok((await raw.sym(A)).startsWith('zenc1:k1:'));
  const e = await call(A, 'strains/[id]/entry', 'PUT', { rating: 6, notes: 'y' }, { id: String(strain) });
  assert.equal(e.status, 200);
  assert.equal(e.json.entry.rating, 6);
  assert.ok(e.json.noteError);
  assert.equal((await call(A, 'prescriptions', 'POST', { issuedOn: day, grams: 5, note: 'z' })).status, 422);
  assert.equal((await call(A, 'prescriptions', 'POST', { issuedOn: day, grams: 5 })).status, 200); // bez notatki działa
  assert.equal((await call(A, 'strains/[id]/tests', 'POST', { note: 'z' }, { id: String(strain) })).status, 422);
  const imp = await call(A, 'import', 'POST', { rows: [{ name: 'BezKlucza', producer: 'X', type: 'haze', notes: 'tajne' }, { name: 'BezNotatki', producer: 'X', type: 'haze' }] });
  assert.equal(imp.status, 200);
  assert.deepEqual([imp.json.added, imp.json.errors.length], [1, 1]);
  setKey(K1);
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows.find((x) => x.day === day).note, 'Przed awarią'); // oryginał przetrwał
  await q`DELETE FROM strains WHERE name IN ('BezKlucza', 'BezNotatki')`;
});

// ---- szyfrogram, którego nie da się odczytać (brak klucza, usunięty kid): GET zwraca '' + flagę, zapis go nie nadpisuje ----
const lockedFlow = async (hide) => {
  const A = ids.ania, day = D(10);
  await q`DELETE FROM symptom_log WHERE user_id = ${A}`; await q`DELETE FROM user_strain WHERE user_id = ${A}`; await q`DELETE FROM strain_tests WHERE user_id = ${A}`;
  setKey(K1);
  assert.equal((await call(A, 'symptoms', 'PUT', { day, pain: 5, note: 'Nie zgub mnie' })).status, 200);
  assert.equal((await call(A, 'strains/[id]/entry', 'PUT', { rating: 5, notes: 'Wpis do zachowania' }, { id: String(strain) })).status, 200);
  assert.equal((await call(A, 'strains/[id]/tests', 'POST', { note: 'Test do zachowania', visibility: 'me' }, { id: String(strain) })).status, 200);
  const before_ = [await raw.sym(A), await raw.us(A), (await raw.test(A)).note];
  assert.ok(before_.every((v) => v.startsWith('zenc1:k1:')));
  hide();

  const g = await call(A, 'symptoms', 'GET');
  const row = g.json.rows.find((x) => x.day === day);
  assert.deepEqual([row.note, row.noteLocked], ['', true]);
  assert.ok(!JSON.stringify(g.json).includes(dc.LOCKED_NOTE));
  // PUT dokładnie z tym, co zwrócił GET, ze zmienioną oceną
  assert.equal((await call(A, 'symptoms', 'PUT', { ...row, pain: 8 })).status, 200);
  // stary klient (z pamięci podręcznej) odsyła znacznik
  assert.equal((await call(A, 'symptoms', 'PUT', { day, pain: 7, note: dc.LOCKED_NOTE })).status, 200);
  assert.equal((await q`SELECT pain FROM symptom_log WHERE user_id = ${A}`)[0].pain, 7);

  const en = await call(A, 'strains/[id]/entry', 'PUT', { rating: 9, notes: '' }, { id: String(strain) });
  assert.equal(en.status, 200);
  assert.deepEqual([en.json.entry.notes, en.json.entry.notesLocked], ['', true]);
  assert.equal((await call(A, 'strains/[id]/entry', 'PUT', { rating: 4, notes: dc.LOCKED_NOTE }, { id: String(strain) })).status, 200);
  assert.equal((await q`SELECT rating::int AS r FROM user_strain WHERE user_id = ${A}`)[0].r, 4);

  const t = (await call(A, 'strains/[id]/tests', 'GET', null, { id: String(strain) })).json.tests[0];
  assert.deepEqual([t.note, t.noteLocked], ['', true]);
  assert.equal((await call(A, 'tests/[tid]', 'PATCH', { note: t.note, visibility: 'friends' }, { tid: String(t.id) })).status, 200); // zachowana notatka liczy się jako opis
  assert.equal((await call(A, 'tests/[tid]', 'PATCH', { note: dc.LOCKED_NOTE, visibility: 'me' }, { tid: String(t.id) })).status, 200);
  assert.equal((await q`SELECT visibility FROM strain_tests WHERE id = ${t.id}`)[0].visibility, 'me');

  assert.deepEqual([await raw.sym(A), await raw.us(A), (await raw.test(A)).note], before_); // szyfrogramy nietknięte
  setKey(K1);
  assert.equal((await call(A, 'symptoms', 'GET')).json.rows[0].note, 'Nie zgub mnie');
  assert.equal((await call(A, 'strains/[id]/entry', 'PUT', { rating: 4, notes: 'Wpis do zachowania' }, { id: String(strain) })).json.entry.notes, 'Wpis do zachowania');
  assert.equal((await call(A, 'strains/[id]/tests', 'GET', null, { id: String(strain) })).json.tests[0].note, 'Test do zachowania');
};

test('brak klucza: GET zwraca pusty tekst i flagę, zapis (także ze znacznikiem) nie nadpisuje szyfrogramu; po przywróceniu klucza notatka wraca', { skip }, async () => {
  await lockedFlow(() => setKey(null));
});

test('usunięty stary kid: to samo co brak klucza', { skip }, async () => {
  await lockedFlow(() => setKey(K2));
});

test('nowy tekst zastępuje nieczytelną notatkę (świadoma decyzja użytkownika)', { skip }, async () => {
  const A = ids.ania;
  setKey(K1);
  await call(A, 'symptoms', 'PUT', { day: D(11), pain: 1, note: 'stara' });
  setKey(K2);
  assert.equal((await call(A, 'symptoms', 'PUT', { day: D(11), pain: 1, note: 'nowa' })).status, 200);
  const [{ note }] = await q`SELECT note FROM symptom_log WHERE user_id = ${A} AND day = ${D(11)}::date`;
  assert.ok(note.startsWith('zenc1:k2:'));
  setKey(K1);
});

test('jawna notatka zaczynająca się od zenc1:/zplain: bez klucza dostaje zplain:, odczyt zwraca oryginał; encrypt-notes i gotowość to uwzględniają', { skip }, async () => {
  const A = ids.ania;
  const { run } = await import('../../scripts/encrypt-notes.mjs');
  const sql = { query: async (t, p) => (await pool.query(t, p)).rows };
  await q`DELETE FROM symptom_log`; await q`DELETE FROM user_strain`; await q`DELETE FROM prescriptions`; await q`DELETE FROM strain_tests`; // bez cudzych szyfrogramów (gotowość)
  setKey(null);
  const texts = ['zenc1:k1:AAAA udawany szyfrogram', 'zplain:ja też', 'zwykła'];
  const days = [D(14), D(13), D(12)];
  for (const [i, text] of texts.entries()) assert.equal((await call(A, 'symptoms', 'PUT', { day: days[i], pain: 1, note: text })).status, 200);
  const stored = (await q`SELECT note FROM symptom_log WHERE user_id = ${A} ORDER BY day`).map((r) => r.note);
  assert.deepEqual(stored, ['zplain:zenc1:k1:AAAA udawany szyfrogram', 'zplain:zplain:ja też', 'zwykła']);
  const notes = async () => (await call(A, 'symptoms', 'GET')).json.rows.map((r) => [r.note, !!r.noteLocked]);
  assert.deepEqual(await notes(), texts.map((t) => [t, false]));
  assert.deepEqual((await call(A, 'account/export', 'GET')).json.symptoms.map((r) => r.note), texts);
  // gotowość nie bierze ich za szyfrogramy
  const { readinessReport } = await import('../../lib/readiness.js');
  const rr = await readinessReport();
  assert.equal(rr.dataEncryption.critical, false);
  assert.equal(rr.dataEncryption.columns.find((c) => c.table === 'symptom_log').plain, 3);
  // przepisanie szyfruje oryginalny tekst (bez zplain:), --decrypt wraca do postaci jawnej z ucieczką
  setKey(K1);
  assert.equal((await run(sql, { table: 'symptom_log' })).failed, 0);
  assert.ok((await q`SELECT note FROM symptom_log WHERE user_id = ${A}`).every((r) => r.note.startsWith('zenc1:k1:')));
  assert.deepEqual(await notes(), texts.map((t) => [t, false]));
  assert.equal((await run(sql, { table: 'symptom_log', decrypt: true })).failed, 0);
  assert.deepEqual((await q`SELECT note FROM symptom_log WHERE user_id = ${A} ORDER BY day`).map((r) => r.note), stored);
  setKey(null);
  assert.deepEqual(await notes(), texts.map((t) => [t, false]));
  setKey(K1);
});

test('AAD z kluczem wiersza: szyfrogram przeniesiony do innego wiersza TEGO SAMEGO konta jest nieczytelny', { skip }, async () => {
  const A = ids.ania;
  await q`DELETE FROM symptom_log WHERE user_id = ${A}`; await q`DELETE FROM prescriptions WHERE user_id = ${A}`; await q`DELETE FROM user_strain WHERE user_id = ${A}`;
  setKey(K1);
  await call(A, 'symptoms', 'PUT', { day: D(21), pain: 1, note: 'dzień 1' });
  await call(A, 'prescriptions', 'POST', { issuedOn: D(21), grams: 5, note: 'recepta 1' });
  await call(A, 'prescriptions', 'POST', { issuedOn: D(20), grams: 5, note: 'recepta 2' });
  const [s2] = await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Druga', 'haze', ${A}) RETURNING id`;
  await call(A, 'strains/[id]/entry', 'PUT', { rating: 5, notes: 'odmiana 1' }, { id: String(strain) });
  await call(A, 'strains/[id]/entry', 'PUT', { rating: 5, notes: 'odmiana 2' }, { id: String(s2.id) });
  await q`INSERT INTO symptom_log (user_id, day, note) SELECT user_id, ${D(20)}::date, note FROM symptom_log WHERE user_id = ${A} AND day = ${D(21)}::date`;
  await q`UPDATE prescriptions SET note = (SELECT note FROM prescriptions WHERE user_id = ${A} AND issued_on = ${D(21)}::date) WHERE user_id = ${A} AND issued_on = ${D(20)}::date`;
  await q`UPDATE user_strain SET notes = (SELECT notes FROM user_strain WHERE user_id = ${A} AND strain_id = ${strain}) WHERE user_id = ${A} AND strain_id = ${s2.id}`;
  const rows = (await call(A, 'symptoms', 'GET')).json.rows;
  assert.deepEqual(rows.map((r) => [r.day, r.note, !!r.noteLocked]), [[D(21), 'dzień 1', false], [D(20), '', true]]);
  assert.deepEqual((await call(A, 'prescriptions', 'GET')).json.prescriptions.map((p) => p.note).sort(), [dc.LOCKED_NOTE, 'recepta 1'].sort());
  const ent = (await listStrains(A)).find((s) => s.id === s2.id).entries.find((x) => x.userId === A);
  assert.deepEqual([ent.notes, ent.notesLocked], ['', true]);
  assert.ok(!('strainId' in ent)); // pole pomocnicze do AAD nie trafia do klienta
  assert.ok(!JSON.stringify((await call(A, 'account/export', 'GET')).json.entries).includes('strain_id'));
  await q`DELETE FROM strains WHERE id = ${s2.id}`;
});

test('gotowość: pozycja data-key (brak / ok / słaby format / krytyczny) i postęp przepisania, tylko liczby', { skip }, async () => {
  const { readinessReport } = await import('../../lib/readiness.js');
  await q`DELETE FROM symptom_log`; await q`DELETE FROM user_strain`; await q`DELETE FROM prescriptions`; await q`DELETE FROM strain_tests`;
  const A = ids.ania;
  const item = async () => { const r = await readinessReport(); return { c: r.checks.find((x) => x.id === 'data-key'), e: r.dataEncryption, r }; };

  setKey(null);
  let x = await item();
  assert.equal(x.c.state, 'missing'); assert.equal(x.c.optional, true); assert.equal(x.e.critical, false);

  await q`INSERT INTO prescriptions (user_id, issued_on, grams, note) VALUES (${A}, '2026-09-01', 5, 'jawna 1'), (${A}, '2026-09-02', 5, 'jawna 2'), (${A}, '2026-09-03', 5, '')`;
  setKey(K1);
  x = await item();
  assert.equal(x.c.state, 'ok');
  assert.match(x.c.hint, /2 jawnych/);
  assert.deepEqual(x.e.columns.find((c) => c.table === 'prescriptions'), { table: 'prescriptions', column: 'note', plain: 2, encrypted: 0, oldKid: 0 });

  await q`INSERT INTO prescriptions (user_id, issued_on, grams, note) VALUES (${A}, '2026-09-04', 5, ${dc.encryptField('prescriptions', 'note', A, 'tajna')})`;
  setKey(`${K2},${K1}`);
  x = await item();
  assert.equal(x.c.state, 'ok');
  assert.deepEqual(x.e.columns.find((c) => c.table === 'prescriptions'), { table: 'prescriptions', column: 'note', plain: 2, encrypted: 1, oldKid: 1 });

  for (const key of [K2, null]) { // szyfrogram k1 nieczytelny: krytyczne
    setKey(key);
    x = await item();
    assert.equal(x.c.state, 'critical');
    assert.equal(x.c.optional, false);
    assert.equal(x.e.unreadable, 1);
  }
  setKey('zly-format');
  x = await item();
  assert.equal(x.c.state, 'critical'); // szyfrogramy są, a klucza nie da się użyć
  await q`DELETE FROM prescriptions WHERE note LIKE 'zenc1:%'`;
  x = await item();
  assert.equal(x.c.state, 'weak'); assert.equal(x.c.optional, false);

  setKey(`${K2},${K1}`);
  const text = JSON.stringify((await item()).r);
  assert.ok(!text.includes(K1.slice(3)) && !text.includes(K2.slice(3)));
  setKey(K1);
});

test('kopia: backup-decrypt --data-key odszyfrowuje notatki, restore-drill sprawdza je kluczem', { skip }, async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { gzipSync } = await import('node:zlib');
  const { join } = await import('node:path');
  const { verifyNotes } = await import('../../scripts/dev/restore-drill.mjs');
  await q`DELETE FROM symptom_log`; await q`DELETE FROM prescriptions`; await q`DELETE FROM strain_tests`;
  const A = ids.ania;
  assert.equal((await call(A, 'prescriptions', 'POST', { issuedOn: TODAY(), grams: 5, note: 'Tajna recepta' })).status, 200);
  assert.equal((await call(A, 'strains/[id]/tests', 'POST', { note: 'Tajny test' }, { id: String(strain) })).status, 200);

  assert.deepEqual(await verifyNotes(pool), { checked: 2, failed: 0 });
  setKey(K2);
  assert.deepEqual(await verifyNotes(pool), { checked: 2, failed: 2 });
  setKey(K1);

  const dir = mkdtempSync(join(tmpdir(), 'enc28-'));
  const file = join(dir, 'kopia.json.gz');
  writeFileSync(file, gzipSync(JSON.stringify(await buildBackup())));
  const script = new URL('../../scripts/backup-decrypt.js', import.meta.url).pathname;
  const run = (args, env) => spawnSync(process.execPath, ['--experimental-default-type=module', script, ...args], { env: { PATH: process.env.PATH, ...env }, encoding: 'utf8', maxBuffer: 1 << 26 });
  const plain = run([file], {});
  assert.equal(plain.status, 0);
  assert.ok(plain.stdout.includes('zenc1:') && !plain.stdout.includes('Tajna recepta'));
  const dec = run(['--data-key', file], { DATA_ENCRYPTION_KEY: K1 });
  assert.equal(dec.status, 0, dec.stderr);
  assert.ok(dec.stdout.includes('Tajna recepta') && dec.stdout.includes('Tajny test') && !dec.stdout.includes('zenc1:'));
  assert.match(dec.stderr, /odszyfrowano 2, nieodczytane 0/);
  const noKey = run(['--data-key', file], {});
  assert.notEqual(noKey.status, 0);
  assert.equal(readFileSync(file).length > 0, true);
});
