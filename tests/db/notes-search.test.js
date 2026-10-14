// POM-17 „Moje notatki” na /szukaj (lib/notes-search.js): notatki szyfrowane, bez polskich znaków, tylko własne,
// notatka bez klucza (zablokowana) nie wraca. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const KEY = `t1:${Buffer.alloc(32, 7).toString('base64')}`;
const OTHER = `t9:${Buffer.alloc(32, 9).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
let q, jar, pool, createSession, searchNotes;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  process.env.DATA_ENCRYPTION_KEY = KEY;
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  ({ searchNotes } = await import('../../lib/notes-search.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => {
  if (savedKey == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = savedKey;
  if (pool) await pool.end();
});

const ok = (r) => assert.ok(r.status < 400, JSON.stringify(r.json));

test('notatki z dziennika, odmiany, recepty i „Do omówienia”: szyfrowane w bazie, znalezione bez polskich znaków', { skip }, async () => {
  const A = ids.ania;
  ok(await call(A, 'symptoms', 'PUT', { day: '2026-10-01', pain: 4, note: 'Po Żółtym gorzej spałam, ból głowy' }));
  ok(await call(A, 'symptoms', 'PUT', { day: '2026-10-03', pain: 3, note: 'Spokojny dzień' }));
  const sid = (await call(A, 'strains', 'POST', { name: 'Notatkowa', producer: 'Aurora', type: 'haze' })).json.id;
  ok(await call(A, 'strains/[id]/entry', 'PUT', { notes: 'Żółty kolor szyszek, mocny zapach', rating: 7 }, { id: String(sid) }));
  ok(await call(A, 'prescriptions', 'POST', { issuedOn: '2026-09-20', validUntil: '2026-12-20', grams: 30, unit: 'g', note: 'dr Żółkiewska' }));
  ok(await call(A, 'doctor-notes', 'POST', { text: 'Zapytać o żółtą plamkę w oku' }));
  const [{ note }] = await q`SELECT note FROM symptom_log WHERE user_id = ${A} AND day = '2026-10-01'`;
  assert.ok(note.startsWith('zenc1:'), 'notatka dnia zaszyfrowana w bazie');

  const r = await searchNotes(A, 'zol');
  assert.deepEqual(r.map((x) => x.kind).sort(), ['day', 'doctor', 'feel', 'rx']);
  const day = r.find((x) => x.kind === 'day');
  assert.equal(day.day, '2026-10-01');
  assert.equal(day.href, '/dziennik');
  assert.equal(day.snip.hit, 'Żół');
  assert.equal(r.find((x) => x.kind === 'feel').href, `/strains/${sid}`);
  // najnowsze najpierw (dzień notatki o odmianie i „Do omówienia” to dziś)
  assert.equal(r.at(-1).kind, 'rx');
  // kilka słów: wszystkie muszą wystąpić
  assert.deepEqual((await searchNotes(A, 'zolty bol')).map((x) => x.kind), ['day']);
  // od 2 znaków
  assert.deepEqual(await searchNotes(A, 'z'), []);
});

test('tylko własne notatki; zablokowana (inny klucz) nie wraca', { skip }, async () => {
  const B = ids.bartek;
  ok(await call(B, 'symptoms', 'PUT', { day: '2026-10-02', pain: 5, note: 'żółty dzień bartka' }));
  const mine = await searchNotes(B, 'zolty');
  assert.equal(mine.length, 1);
  assert.match(mine[0].snip.after, /bartka/);
  assert.ok((await searchNotes(ids.ania, 'bartka')).length === 0, 'cudza notatka nie wraca');

  // notatka zapisana innym kluczem (np. po utracie klucza) jest zablokowana i pomijana, bez błędu
  process.env.DATA_ENCRYPTION_KEY = OTHER;
  ok(await call(B, 'symptoms', 'PUT', { day: '2026-10-04', pain: 5, note: 'żółta notatka nieczytelna' }));
  process.env.DATA_ENCRYPTION_KEY = KEY;
  const r = await searchNotes(B, 'zolt');
  assert.equal(r.length, 1);
  assert.equal(r[0].day, '2026-10-02');
});
