// POM-03: sposób i pora przyjęcia przy „Zużyłem” (POST, korekta w Historii, historia, raport, eksport konta).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, todayPL, addDaysIso;
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

const create = async (uid, f) => (await call(uid, 'strains', 'POST', { type: 'haze', ...f })).json.id;
const setEntry = async (uid, id, body) => {
  const r = await call(uid, 'strains/[id]/entry', 'PUT', body, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json;
};
const fixUse = (uid, entryId, body) => call(uid, 'history/usage/[id]', 'PATCH', body, { id: String(entryId) });
const stock = async (uid, id) => Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${id} AND user_id = ${uid}`)[0].current_amount);

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
  ({ todayPL, addDaysIso } = await import('../../lib/date.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

const row = async (id) => (await q`SELECT method, period, usage_period(period, created_at) AS eff FROM usage_log WHERE id = ${id}`)[0];
const post = (uid, s, body) => call(uid, 'strains/[id]/usage', 'POST', { grams: 0.5, requestId: randomUUID(), ...body }, { id: String(s) });

test('zapis zużycia przyjmuje sposób i porę; bez nich pola są puste, a pora wynika z godziny zapisu', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Sposób 1', producer: 'Aurora' });
  await setEntry(A, s, { current: 20 });
  const plain = await post(A, s, {});
  assert.equal(plain.status, 200);
  assert.deepEqual([(await row(plain.json.id)).method, (await row(plain.json.id)).period], [null, null]);
  const full = await post(A, s, { method: 'vaporizer', period: 'evening' });
  assert.equal(full.status, 200, JSON.stringify(full.json));
  assert.deepEqual(await row(full.json.id), { method: 'vaporizer', period: 'evening', eff: 'evening' });
  // wpis z kolejki offline: pora wyliczana z godziny telefonu
  const at = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const queued = await post(A, s, { method: 'other', at });
  const e = await row(queued.json.id);
  assert.equal(e.method, 'other');
  assert.ok(['morning', 'day', 'evening', 'night'].includes(e.eff));
  // błędne wartości: 400 i brak zapisu, stan bez zmian
  const before = await stock(A, s);
  for (const b of [{ method: 'inhalator' }, { period: 'poranek' }, { method: 5 }]) assert.equal((await post(A, s, b)).status, 400);
  assert.equal(await stock(A, s), before);
});

test('pora z godziny: granice rano/dzień/wieczór/noc w czasie polskim', { skip }, async () => {
  const cases = [['2026-07-01T02:59:00Z', 'night'], ['2026-07-01T03:00:00Z', 'morning'], ['2026-07-01T08:59:00Z', 'morning'],
    ['2026-07-01T09:00:00Z', 'day'], ['2026-07-01T14:59:00Z', 'day'], ['2026-07-01T15:00:00Z', 'evening'],
    ['2026-07-01T19:59:00Z', 'evening'], ['2026-07-01T20:00:00Z', 'night'], ['2026-12-01T03:59:00Z', 'night'], ['2026-12-01T04:00:00Z', 'morning']];
  for (const [at, want] of cases) assert.equal((await q`SELECT usage_period(NULL, ${at}::timestamptz) AS p`)[0].p, want, at);
  assert.equal((await q`SELECT usage_period('day', ${cases[0][0]}::timestamptz) AS p`)[0].p, 'day');
});

test('korekta w Historii zmienia sposób i porę (także samą), czyści je i nie rusza stanu', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const s = await create(A, { name: 'Sposób 2', producer: 'Aurora' });
  await setEntry(A, s, { current: 10 });
  const u = await post(A, s, { grams: 1, method: 'vaporizer' });
  assert.equal(await stock(A, s), 9);
  const r1 = await fixUse(A, u.json.id, { method: 'oil', period: 'morning' });
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.deepEqual(await row(u.json.id), { method: 'oil', period: 'morning', eff: 'morning' });
  assert.equal(await stock(A, s), 9);
  await fixUse(A, u.json.id, { grams: 2 }); // zmiana samych gramów zostawia sposób i porę
  assert.deepEqual([(await row(u.json.id)).method, (await row(u.json.id)).period], ['oil', 'morning']);
  await fixUse(A, u.json.id, { period: null }); // pora wraca do wyliczanej z godziny
  assert.deepEqual([(await row(u.json.id)).method, (await row(u.json.id)).period], ['oil', null]);
  await fixUse(A, u.json.id, { method: '' });
  assert.equal((await row(u.json.id)).method, null);
  assert.equal((await fixUse(A, u.json.id, { method: 'x' })).status, 400);
  assert.equal((await fixUse(A, u.json.id, {})).status, 400, 'nic do zmiany');
  assert.equal((await fixUse(B, u.json.id, { method: 'other' })).status, 404, 'cudzy wpis');
});

test('historia, eksport konta, raport i kopia niosą sposób i porę', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Sposób 3', producer: 'Aurora', form: 'olej' });
  await setEntry(A, s, { current: 30 });
  const u = await post(A, s, { grams: 0.25, method: 'oil', period: 'night' });
  const { history } = await import('../../lib/strains.js');
  const h = (await history(A)).usage.find((x) => x.id === u.json.id);
  assert.deepEqual([h.method, h.period], ['oil', 'night']);
  assert.ok(['morning', 'day', 'evening', 'night'].includes(h.autoPeriod));
  const ex = await call(A, 'account/export', 'GET');
  const eu = ex.json.usage.find((x) => x.strain === 'Sposób 3');
  assert.deepEqual([eu.method, eu.period], ['oil', 'night']);
  const day = todayPL();
  const rep = await (await import('../../lib/report.js')).doctorReport(A, addDaysIso(day, -1), day);
  const n = (k, key) => rep.whenUsed[k].find((r) => r.key === key)?.n;
  assert.ok(n('period', 'night') >= 1 && n('method', 'oil') >= 1);
  const bk = await (await import('../../lib/backup.js')).buildBackup();
  assert.ok(bk.usage_log.some((r) => r.id === u.json.id && r.method === 'oil' && r.period === 'night'));
});
