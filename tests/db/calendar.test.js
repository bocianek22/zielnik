// Plik kalendarza (app/api/calendar): tylko zalogowani, stały tytuł (dyskretny przy ciasteczku), tylko daty od dziś do roku.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession;
const ids = {};

async function call(uid, route, method, body, params = {}, qs = '', cookie = '') {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}${qs}`, {
    method, headers: { 'content-type': 'application/json', ...(cookie && { cookie }) }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, json: type.includes('json') ? await res.json() : null, text: type.includes('csv') || type.includes('calendar') ? await res.text() : null, res };
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
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
});

after(async () => { if (pool) await pool.end(); });


const day = (n) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + n * 864e5));

test('kalendarz: logowanie, walidacja, plik i tryb dyskretny', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(null, 'calendar', 'GET', null, {}, `?typ=wykup&dzien=${day(3)}`)).status, 401);
  assert.equal((await call(A, 'calendar', 'GET', null, {}, `?typ=hasla&dzien=${day(3)}`)).status, 400);
  assert.equal((await call(A, 'calendar', 'GET', null, {}, `?typ=wykup&dzien=${day(-1)}`)).status, 400);
  assert.equal((await call(A, 'calendar', 'GET', null, {}, `?typ=wykup&dzien=${day(400)}`)).status, 400);
  assert.equal((await call(A, 'calendar', 'GET', null, {}, '?typ=wykup&dzien=jutro')).status, 400);
  const r = await call(A, 'calendar', 'GET', null, {}, `?typ=wykup&dzien=${day(3)}`);
  assert.equal(r.status, 200);
  assert.match(r.res.headers.get('content-type'), /text\/calendar/);
  assert.match(r.res.headers.get('content-disposition'), new RegExp(`filename="wykup-${day(3)}\\.ics"`));
  assert.match(r.text, /SUMMARY:Apteka: wykup/);
  const d = await call(A, 'calendar', 'GET', null, {}, `?typ=wizyta&dzien=${day(0)}`, 'zielnik_discreet=1');
  assert.equal(d.status, 200);
  assert.match(d.text, /SUMMARY:Spotkanie/);
  assert.doesNotMatch(d.text + d.res.headers.get('content-disposition'), /lekarz|wizyta|zielnik/i);
});
