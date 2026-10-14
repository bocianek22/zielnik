// Zdarzenia niepożądane (POM-62): tylko własne, opis szyfrowany, walidacja (bez przyszłości), wyszukiwarka, karta dnia,
// raport (opis tylko ze spostrzeżeniami), eksport i import kopii bez duplikatów. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
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

let d1, d2;
test('zdarzenia: zapis szyfrowany, lista tylko własna, walidacja, usuwanie tylko własnych', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  d1 = addDaysIso(todayPL(), -3); d2 = addDaysIso(todayPL(), -1);
  const r = ok(await call(A, 'adverse', 'POST', { day: d1, severity: 'umiarkowane', note: 'Kołatanie serca po południu' }));
  assert.equal(r.events.length, 1);
  assert.deepEqual([r.events[0].day, r.events[0].severity, r.events[0].note], [d1, 'umiarkowane', 'Kołatanie serca po południu']);
  const [{ note }] = await q`SELECT note FROM adverse_events WHERE user_id = ${A}`;
  assert.ok(note.startsWith('zenc1:'), 'opis zaszyfrowany w bazie');
  assert.deepEqual(ok(await get(B, 'adverse')).events, []);
  assert.equal((await call(A, 'adverse', 'POST', { day: addDaysIso(todayPL(), 1), severity: 'silne' })).status, 400, 'bez przyszłości');
  assert.equal((await call(A, 'adverse', 'POST', { day: '2026-02-31', severity: 'silne' })).status, 400);
  assert.equal((await call(A, 'adverse', 'POST', { day: '1999-12-31', severity: 'silne' })).status, 400);
  assert.equal((await call(A, 'adverse', 'POST', { day: d2, severity: 'ciezkie' })).status, 400);
  assert.equal((await call(A, 'adverse', 'POST', { day: d2, severity: 'silne', note: 'x'.repeat(1001) })).status, 400);
  ok(await call(A, 'adverse', 'POST', { day: d2, severity: 'lagodne' }));
  const id = r.events[0].id;
  assert.equal((await call(B, 'adverse/[id]', 'DELETE', null, { id: String(id) })).status, 404);
  assert.equal((await call(A, 'adverse/[id]', 'DELETE', null, { id: 'abc' })).status, 404);
  assert.equal(ok(await get(A, 'adverse')).events.length, 2);
  assert.deepEqual(ok(await get(A, 'adverse')).events.map((e) => e.day), [d2, d1], 'najnowsze najpierw');
});

test('zdarzenia: wyszukiwarka, karta dnia i raport (opis tylko ze spostrzeżeniami)', { skip }, async () => {
  const A = ids.ania;
  const hits = await searchNotes(A, 'kołatanie');
  assert.equal(hits.find((h) => h.kind === 'adverse')?.day, d1);
  assert.equal((await searchNotes(ids.bartek, 'kołatanie')).length, 0);
  const card = ok(await get(A, `day?d=${d1}`));
  assert.deepEqual(card.adverse, [{ severity: 'umiarkowane', note: 'Kołatanie serca po południu', noteLocked: false }]);
  const { doctorReport } = await import('../../lib/report.js');
  const from = addDaysIso(todayPL(), -29), to = todayPL();
  const plain = await doctorReport(A, from, to);
  assert.deepEqual(plain.adverse, [{ day: d2, severity: 'lagodne', note: '' }, { day: d1, severity: 'umiarkowane', note: '' }]);
  const full = await doctorReport(A, from, to, { withNotes: true });
  assert.equal(full.adverse.find((a) => a.day === d1).note, 'Kołatanie serca po południu');
  assert.deepEqual((await doctorReport(A, addDaysIso(todayPL(), -400), addDaysIso(todayPL(), -300))).adverse, [], 'tylko z okresu');
  assert.deepEqual((await doctorReport(ids.bartek, from, to, { withNotes: true })).adverse, []);
});

test('zdarzenia: nieczytelny opis (inny klucz) wraca pusty z flagą', { skip }, async () => {
  const A = ids.ania;
  process.env.DATA_ENCRYPTION_KEY = `t9:${Buffer.alloc(32, 9).toString('base64')}`;
  try {
    const list = ok(await get(A, 'adverse')).events;
    const withNote = list.find((e) => e.day === d1);
    assert.equal(withNote.note, ''); assert.equal(withNote.noteLocked, true);
  } finally { process.env.DATA_ENCRYPTION_KEY = KEY; }
});

test('zdarzenia: eksport i import kopii (bez duplikatów, bez przyszłych dat), usuwanie konta kasuje zdarzenia', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  jar.clear(); await createSession(A);
  const exp = await (await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export'))).json();
  assert.deepEqual(exp.adverseEvents.map((v) => [v.day, v.severity, v.note]), [[d1, 'umiarkowane', 'Kołatanie serca po południu'], [d2, 'lagodne', '']]);
  assert.ok(exp.adverseEvents.every((v) => !('id' in v)));
  const { importBackup } = await import('../../lib/import-backup-db.js');
  const sec = (r, k) => r.sections.find((s) => s.key === k) ?? { added: 0, existing: 0, invalid: 0 };
  const bad = { ...exp, adverseEvents: [...exp.adverseEvents, { day: addDaysIso(todayPL(), 5), severity: 'silne', note: '' }, { day: addDaysIso(todayPL(), 1), severity: 'silne', note: '' }, { day: d1, severity: 'zle', note: '' }] };
  const r1 = sec(await importBackup(B, bad), 'adverseEvents');
  assert.equal(r1.added, 2); assert.equal(r1.invalid, 3);
  assert.equal(sec(await importBackup(B, exp), 'adverseEvents').existing, 2);
  const listB = ok(await get(B, 'adverse')).events;
  assert.equal(listB.length, 2);
  assert.equal(listB.find((v) => v.day === d1).note, 'Kołatanie serca po południu');
  const [{ note }] = await q`SELECT note FROM adverse_events WHERE user_id = ${B} AND day = ${d1}::date`;
  assert.ok(note.startsWith('zenc1:'), 'import też szyfruje');
  await q`DELETE FROM users WHERE id = ${B}`;
  assert.equal((await q`SELECT count(*)::int AS n FROM adverse_events WHERE user_id = ${B}`)[0].n, 0);
});
