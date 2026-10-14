// Czynniki dnia (POM-47): limit 8 i unikalna nazwa, znaczniki tylko własnych czynników, zapis z wpisem dnia, usunięcie
// dnia i czynnika (kaskada), zestawienie w obserwacjach (próg, sen z poprzedniego dnia), eksport i import kopii.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const KEY = `t1:${Buffer.alloc(32, 7).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
let q, jar, pool, createSession;
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
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek', 'celina']) {
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
const ago = (n) => q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date - ${n}::int, 'YYYY-MM-DD') AS d`.then((r) => r[0].d);

test('czynniki: limit 8, unikalna nazwa (bez wielkości liter), zmiana nazwy, tylko własne', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  for (const n of ['stres', 'ruch', 'kofeina', 'alkohol', 'spacer', 'upał', 'podróż', 'praca']) ok(await call(A, 'factors', 'POST', { name: n }));
  const r9 = await call(A, 'factors', 'POST', { name: 'dziewiąty' });
  assert.equal(r9.status, 409);
  assert.equal((await call(B, 'factors', 'POST', { name: 'STRES' })).status, 200, 'inne konto może mieć tę samą nazwę');
  const list = ok(await get(A, 'factors')).factors;
  assert.equal(list.length, 8);
  const ruch = list.find((f) => f.name === 'ruch');
  assert.equal((await call(A, 'factors/[id]', 'PATCH', { name: 'Stres' }, { id: String(ruch.id) })).status, 409);
  assert.equal(ok(await call(A, 'factors/[id]', 'PATCH', { name: 'ruch na dworze' }, { id: String(ruch.id) })).def.name, 'ruch na dworze');
  assert.equal((await call(B, 'factors/[id]', 'PATCH', { name: 'cudzy' }, { id: String(ruch.id) })).status, 404);
  assert.equal((await call(B, 'factors/[id]', 'DELETE', null, { id: String(ruch.id) })).status, 404);
  assert.equal((await call(A, 'factors', 'POST', { name: 'a'.repeat(31) })).status, 400);
});

test('znaczniki: zapis z wpisem dnia, cudze id ignorowane, bez pola bez zmian, usunięcie dnia i czynnika', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const mine = ok(await get(A, 'factors')).factors;
  const theirs = ok(await get(B, 'factors')).factors[0];
  const d = await ago(1);
  let r = ok(await call(A, 'symptoms', 'PUT', { day: d, pain: 4, factors: [mine[0].id, mine[1].id, theirs.id, 'x'] }));
  assert.deepEqual(r.factorMarks.filter((m) => m.day === d).map((m) => m.id).sort(), [mine[0].id, mine[1].id].sort());
  assert.equal((await q`SELECT count(*)::int AS n FROM day_factor_marks WHERE factor_id = ${theirs.id}`)[0].n, 0);
  r = ok(await call(A, 'symptoms', 'PUT', { day: d, pain: 5 }));
  assert.equal(r.factorMarks.filter((m) => m.day === d).length, 2, 'bez pola factors znaczniki zostają');
  r = ok(await call(A, 'symptoms', 'PUT', { day: d, pain: 5, factors: [mine[1].id] }));
  assert.deepEqual(r.factorMarks.filter((m) => m.day === d).map((m) => m.id), [mine[1].id]);
  // karta dnia pokazuje nazwy
  assert.deepEqual(ok(await get(A, `day?d=${d}`)).factors, [mine[1].name]);
  // usunięcie dnia usuwa jego znaczniki
  ok(await call(A, 'symptoms', 'DELETE', { day: d }));
  assert.equal((await q`SELECT count(*)::int AS n FROM day_factor_marks WHERE user_id = ${A} AND day = ${d}::date`)[0].n, 0);
  // usunięcie czynnika usuwa jego znaczniki
  ok(await call(A, 'symptoms', 'PUT', { day: d, pain: 2, factors: [mine[2].id] }));
  ok(await call(A, 'factors/[id]', 'DELETE', null, { id: String(mine[2].id) }));
  assert.equal((await q`SELECT count(*)::int AS n FROM day_factor_marks WHERE factor_id = ${mine[2].id}`)[0].n, 0);
});

test('obserwacje: dni z czynnikiem i bez od pierwszego zaznaczenia, próg 5 dni, sen z poprzedniego dnia', { skip }, async () => {
  const C = ids.celina;
  const { factorObservations } = await import('../../lib/factor-obs.js');
  const stres = ok(await call(C, 'factors', 'POST', { name: 'stres' })).def;
  await q`INSERT INTO symptom_log (user_id, day, pain) SELECT ${C}, (now() AT TIME ZONE 'Europe/Warsaw')::date - 40, 9`; // przed pierwszym znacznikiem: poza zestawieniem
  for (let n = 1; n <= 12; n++) {
    const d = await ago(n);
    const on = n % 2 === 0; // co drugi dzień, najstarszy (12 dni temu) ze znacznikiem
    await q`INSERT INTO symptom_log (user_id, day, pain, sleep) VALUES (${C}, ${d}::date, ${on ? 7 : 3}, 5)`;
    if (on) await q`INSERT INTO day_factor_marks (factor_id, user_id, day) VALUES (${stres.id}, ${C}, ${d}::date)`;
  }
  const o = await factorObservations(C, 90);
  const f = o.factors.find((x) => x.id === stres.id);
  const pain = f.rows.find((r) => r.key === 'pain');
  assert.deepEqual(pain.with, { days: 6, avg: 7 });
  assert.deepEqual(pain.without, { days: 6, avg: 3 }, 'dzień sprzed pierwszego znacznika pominięty');
  // sen z dnia D zestawiany z czynnikiem z D-1: wpisy z 1..11 dni temu odnoszą się do 2..12 dni temu (12 dni temu
  // nie ma już poprzednika w zestawieniu: 13 dni temu jest przed pierwszym znacznikiem)
  const sleep = f.rows.find((r) => r.key === 'sleep');
  assert.equal(sleep.with.days, 6, 'dni nieparzyste: poprzedni dzień ze znacznikiem');
  assert.equal(sleep.without.days, 5);
  // inne konto nie widzi
  assert.deepEqual((await factorObservations(ids.ania, 90)).factors.find((x) => x.id === stres.id), undefined);
});

test('eksport i import kopii przenoszą czynniki i znaczniki (bez duplikatów przy ponownym imporcie)', { skip }, async () => {
  const C = ids.celina;
  jar.clear(); await createSession(C);
  const exp = await (await (await import('../../app/api/account/export/route.js')).GET(new Request('http://localhost/api/account/export'))).json();
  assert.ok(exp.dayFactors.some((f) => f.name === 'stres'));
  assert.equal(exp.dayFactorMarks.filter((m) => m.factor === 'stres').length, 6);
  const { importBackup } = await import('../../lib/import-backup-db.js');
  const B = ids.bartek;
  const r1 = await importBackup(B, exp);
  const sec = (r, k) => r.sections.find((s) => s.key === k) ?? { added: 0, existing: 0 };
  assert.equal(sec(r1, 'factors').added, 0, 'bartek ma już „STRES”: ta sama nazwa bez wielkości liter');
  assert.equal(sec(r1, 'factors').existing, 1);
  assert.equal(sec(r1, 'factorMarks').added, 6);
  const r2 = await importBackup(B, exp);
  assert.equal(sec(r2, 'factorMarks').added, 0);
  assert.equal(sec(r2, 'factorMarks').existing, 6);
});
