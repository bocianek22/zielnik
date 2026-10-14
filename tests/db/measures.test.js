// Własne pomiary (POM-63): tylko własne, limit 3 i unikalna nazwa, przecinek dziesiętny, bez przyszłych dni, nadpisanie dnia,
// pusta wartość usuwa, karta dnia, raport (min/śr./maks.), eksport i import kopii bez duplikatów, kaskady. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const KEY = `t1:${Buffer.alloc(32, 7).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
let q, jar, pool, createSession, addDaysIso, todayPL;
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

const put = (uid, day, values) => call(uid, 'measures/values', 'PUT', { day, values });

test('pomiary: definicje tylko własne, limit 3, unikalna nazwa, walidacja', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const r = ok(await call(A, 'measures', 'POST', { name: 'Waga', unit: 'kg' }));
  assert.deepEqual(r.defs.map((d) => [d.name, d.unit, d.slot]), [['Waga', 'kg', 1]]);
  assert.equal((await call(A, 'measures', 'POST', { name: 'waga', unit: '' })).status, 409, 'ta sama nazwa bez względu na wielkość liter');
  assert.equal((await call(A, 'measures', 'POST', { name: '' })).status, 400);
  assert.equal((await call(A, 'measures', 'POST', { name: 'x'.repeat(41) })).status, 400);
  assert.equal((await call(A, 'measures', 'POST', { name: 'Coś', unit: 'x'.repeat(13) })).status, 400);
  ok(await call(A, 'measures', 'POST', { name: 'Tętno', unit: 'ud./min' }));
  ok(await call(A, 'measures', 'POST', { name: 'Temperatura', unit: '°C' }));
  assert.equal((await call(A, 'measures', 'POST', { name: 'Czwarty' })).status, 409, 'najwyżej 3');
  assert.deepEqual(ok(await get(B, 'measures')).defs, []);
  const waga = r.def.id;
  assert.equal((await call(B, 'measures/[id]', 'PATCH', { name: 'Moja' }, { id: String(waga) })).status, 404);
  assert.equal((await call(B, 'measures/[id]', 'DELETE', null, { id: String(waga) })).status, 404);
  assert.equal(ok(await call(A, 'measures/[id]', 'PATCH', { unit: 'kilogramy' }, { id: String(waga) })).def.unit, 'kilogramy');
  assert.equal((await call(A, 'measures/[id]', 'PATCH', { name: 'tętno' }, { id: String(waga) })).status, 409);
});

test('pomiary: wartości z przecinkiem, nadpisanie dnia, pusta usuwa, bez przyszłości i cudzych definicji', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const defs = ok(await get(A, 'measures')).defs;
  const [waga, tetno] = defs;
  const t = todayPL(), d1 = addDaysIso(t, -1);
  ok(await put(A, d1, { [waga.id]: '72,5', [tetno.id]: '70' }));
  ok(await put(A, t, { [waga.id]: '72.25', [tetno.id]: 68 }));
  let v = ok(await get(A, 'measures')).values;
  assert.deepEqual(v.filter((x) => x.id === waga.id).map((x) => [x.day, x.value]), [[t, 72.25], [d1, 72.5]]);
  ok(await put(A, d1, { [waga.id]: '73' }));
  ok(await put(A, t, { [tetno.id]: '' }));
  v = ok(await get(A, 'measures')).values;
  assert.equal(v.find((x) => x.id === waga.id && x.day === d1).value, 73, 'nadpisanie');
  assert.equal(v.find((x) => x.id === tetno.id && x.day === d1).value, 70, 'niezmienione pole zostaje');
  assert.equal(v.some((x) => x.id === tetno.id && x.day === t), false, 'pusta usuwa');
  assert.equal((await put(A, addDaysIso(t, 1), { [waga.id]: '70' })).status, 400, 'bez przyszłości');
  assert.equal((await put(A, t, { [waga.id]: '7O' })).status, 400, 'nie liczba');
  assert.equal((await put(A, t, { [waga.id]: '2000000' })).status, 400, 'poza granicami');
  ok(await put(B, t, { [waga.id]: '99' }));
  assert.equal((await q`SELECT count(*)::int AS n FROM measure_values WHERE user_id = ${B}`)[0].n, 0, 'cudza definicja nic nie zapisuje');
  assert.deepEqual(ok(await get(B, 'measures')).values, []);
});

test('pomiary: karta dnia i raport (najmniej, średnio, najwięcej z okresu)', { skip }, async () => {
  const A = ids.ania;
  const t = todayPL(), d1 = addDaysIso(t, -1);
  const card = ok(await get(A, `day?d=${d1}`));
  assert.deepEqual(card.measures.map((m) => [m.name, m.unit, m.value]), [['Waga', 'kilogramy', 73], ['Tętno', 'ud./min', 70]]);
  const { doctorReport } = await import('../../lib/report.js');
  const rep = await doctorReport(A, addDaysIso(t, -29), t);
  const w = rep.measures.find((m) => m.name === 'Waga');
  assert.deepEqual([w.days, w.min, w.max, Math.round(w.avg * 100) / 100], [2, 72.25, 73, 72.63]);
  assert.deepEqual((await doctorReport(ids.bartek, addDaysIso(t, -29), t)).measures, []);
});

test('pomiary: eksport i import kopii bez duplikatów, usunięcie definicji i konta kasuje wartości', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  jar.clear(); await createSession(A);
  const exp = await (await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export'))).json();
  assert.deepEqual(exp.measures.map((m) => [m.name, m.unit]), [['Waga', 'kilogramy'], ['Tętno', 'ud./min'], ['Temperatura', '°C']]);
  assert.equal(exp.measureValues.length, 3);
  const { importBackup } = await import('../../lib/import-backup-db.js');
  const sec = (r, k) => r.sections.find((s) => s.key === k) ?? { added: 0, existing: 0, invalid: 0 };
  const bad = { ...exp, measureValues: [...exp.measureValues, { day: addDaysIso(todayPL(), 1), measure: 'Waga', value: 70 }, { day: todayPL(), measure: 'Waga', value: 'dużo' }] };
  const r1 = await importBackup(B, bad);
  assert.equal(sec(r1, 'measures').added, 3);
  assert.equal(sec(r1, 'measureValues').added, 3);
  assert.equal(sec(r1, 'measureValues').invalid, 2);
  const r2 = await importBackup(B, exp);
  assert.equal(sec(r2, 'measures').existing, 3);
  assert.equal(sec(r2, 'measureValues').existing, 3);
  assert.equal((await q`SELECT count(*)::int AS n FROM measure_values WHERE user_id = ${B}`)[0].n, 3);
  const tetnoB = ok(await get(B, 'measures')).defs.find((d) => d.name === 'Tętno');
  assert.equal(ok(await call(B, 'measures/[id]', 'DELETE', null, { id: String(tetnoB.id) })).removed, 1);
  assert.equal((await q`SELECT count(*)::int AS n FROM measure_values WHERE def_id = ${tetnoB.id}`)[0].n, 0);
  await q`DELETE FROM users WHERE id = ${B}`;
  assert.equal((await q`SELECT count(*)::int AS n FROM measure_defs WHERE user_id = ${B}`)[0].n, 0);
  assert.equal((await q`SELECT count(*)::int AS n FROM measure_values WHERE user_id = ${B}`)[0].n, 0);
});
