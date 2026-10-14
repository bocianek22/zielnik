// Dziennik wizyt (POM-52): tylko własne, notatka szyfrowana, walidacja, następna wizyta w przypomnieniach, wyszukiwarka,
// karta dnia, eksport i import kopii. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const KEY = `t1:${Buffer.alloc(32, 7).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
let q, jar, pool, createSession, searchNotes, addDaysIso, todayPL;
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
  ({ addDaysIso, todayPL } = await import('../../lib/date.js'));
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

const ok = (r) => { assert.ok(r.status < 400, JSON.stringify(r.json)); return r.json; };
async function get(uid, route) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route.split('?')[0]}/route.js`);
  const res = await mod.GET(new Request(`http://localhost/api/${route}`), { params: Promise.resolve({}) });
  return { status: res.status, json: await res.json() };
}

test('wizyty: zapis szyfrowany, lista tylko własna, walidacja, usuwanie tylko własnych', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const r = ok(await call(A, 'visits', 'POST', { day: '2026-10-01', note: 'Ustalono kontrolę za 3 miesiące' }));
  assert.equal(r.visits.length, 1);
  assert.equal(r.visits[0].note, 'Ustalono kontrolę za 3 miesiące');
  const [{ note }] = await q`SELECT note FROM visits WHERE user_id = ${A}`;
  assert.ok(note.startsWith('zenc1:'), 'notatka zaszyfrowana w bazie');
  assert.deepEqual(ok(await get(B, 'visits')).visits, []);
  assert.equal((await call(A, 'visits', 'POST', { day: '2026-02-31' })).status, 400);
  assert.equal((await call(A, 'visits', 'POST', { day: addDaysIso(todayPL(), 400) })).status, 400, 'najwyżej rok naprzód');
  assert.equal((await call(A, 'visits', 'POST', { day: '2026-10-02', note: 'x'.repeat(1001) })).status, 400);
  const id = r.visits[0].id;
  assert.equal((await call(B, 'visits/[id]', 'DELETE', null, { id: String(id) })).status, 404);
  assert.equal(ok(await get(A, 'visits')).visits.length, 1);
});

test('wizyty: następna wizyta trafia do przypomnień, wyszukiwarka i karta dnia widzą notatkę', { skip }, async () => {
  const A = ids.ania;
  const next = addDaysIso(todayPL(), 90);
  const r = ok(await call(A, 'visits', 'POST', { day: '2026-10-05', note: 'Zmiana pory przyjmowania', nextVisit: next }));
  assert.equal(r.notifyVisit, false, 'klient wie, że przypomnienie o wizycie jest wyłączone');
  const nextOf = async () => (await q`SELECT to_char(next_visit_on, 'YYYY-MM-DD') AS d FROM push_prefs WHERE user_id = ${A}`)[0].d;
  assert.equal(await nextOf(), next);
  // stara wizyta z „następną” w przeszłości nie nadpisuje przyszłej daty i nie zapisuje się (400, bez częściowego zapisu)
  const before = (await q`SELECT count(*)::int AS n FROM visits WHERE user_id = ${A}`)[0].n;
  assert.equal((await call(A, 'visits', 'POST', { day: '2025-03-01', nextVisit: '2025-06-01' })).status, 400);
  assert.equal((await call(A, 'visits', 'POST', { day: '2026-10-06', nextVisit: '2027-02-31' })).status, 400);
  assert.equal((await call(A, 'visits', 'POST', { day: next, nextVisit: next })).status, 400, 'następna po dniu tej wizyty');
  assert.equal((await q`SELECT count(*)::int AS n FROM visits WHERE user_id = ${A}`)[0].n, before);
  assert.equal(await nextOf(), next);
  const hits = await searchNotes(A, 'pory przyjmowania');
  assert.equal(hits.find((h) => h.kind === 'visit')?.day, '2026-10-05');
  assert.equal(ok(await get(A, 'day?d=2026-10-05')).visits[0].note, 'Zmiana pory przyjmowania');
  assert.equal((await searchNotes(ids.bartek, 'pory przyjmowania')).length, 0);
});

test('wizyty: nieczytelna notatka (inny klucz) wraca pusta z flagą, a nie jako znacznik do odesłania', { skip }, async () => {
  const A = ids.ania;
  process.env.DATA_ENCRYPTION_KEY = `t9:${Buffer.alloc(32, 9).toString('base64')}`;
  try {
    const list = ok(await get(A, 'visits')).visits;
    assert.ok(list.length > 0 && list.every((v) => v.note === '' && v.noteLocked === true), JSON.stringify(list));
  } finally { process.env.DATA_ENCRYPTION_KEY = KEY; }
});

test('wizyty: eksport i import kopii (bez duplikatów), usuwanie konta kasuje wizyty', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  jar.clear(); await createSession(A);
  const exp = await (await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export'))).json();
  assert.deepEqual(exp.visits.map((v) => [v.day, v.note]), [['2026-10-01', 'Ustalono kontrolę za 3 miesiące'], ['2026-10-05', 'Zmiana pory przyjmowania']]);
  const { importBackup } = await import('../../lib/import-backup-db.js');
  const sec = (r, k) => r.sections.find((s) => s.key === k) ?? { added: 0, existing: 0 };
  assert.equal(sec(await importBackup(B, exp), 'visits').added, 2);
  assert.equal(sec(await importBackup(B, exp), 'visits').existing, 2);
  assert.equal(ok(await get(B, 'visits')).visits.find((v) => v.day === '2026-10-05').note, 'Zmiana pory przyjmowania');
  await q`DELETE FROM users WHERE id = ${B}`;
  assert.equal((await q`SELECT count(*)::int AS n FROM visits WHERE user_id = ${B}`)[0].n, 0);
});
