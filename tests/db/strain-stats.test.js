// "Moje statystyki" odmiany (lib/strain-stats.js): tylko dane właściciela, 12 tygodni w czasie polskim.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, strainStats;
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
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  ({ strainStats } = await import('../../lib/strain-stats.js'));
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

const create = async (uid, name) => (await call(uid, 'strains', 'POST', { name, producer: 'Aurora', type: 'haze' })).json.id;

test('brak danych: zera, 12 pustych tygodni, bez średniej i ostatniego użycia', { skip }, async () => {
  const s = await create(ids.ania, 'Pusta');
  const st = await strainStats(ids.ania, s);
  assert.equal(st.bought, 0);
  assert.equal(st.used, 0);
  assert.equal(st.perDay, null);
  assert.equal(st.lastUse, null);
  assert.equal(st.lastDaysAgo, null);
  assert.equal(st.weeks.length, 12);
  assert.ok(st.weeks.every((w) => w.grams === 0));
});

test('tylko własne zużycia i zakupy tej odmiany; sumy, średnia, ostatnie użycie i tygodnie', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, 'Statystyki');
  const other = await create(A, 'Inna');
  // przez API (zakup zwiększa stan, zużycie go zmniejsza)
  assert.equal((await call(A, 'strains/[id]/purchase', 'POST', { grams: 10 }, { id: String(s) })).status, 200);
  assert.equal((await call(A, 'strains/[id]/usage', 'POST', { grams: 0.5 }, { id: String(s) })).status, 200);
  // wcześniejsze zużycie: 9 dni temu w południe czasu polskiego (odporne na zmianę czasu i godziny bliskie północy)
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at)
          VALUES (${A}, ${s}, 1.5, (((now() AT TIME ZONE 'Europe/Warsaw')::date - 9) + time '12:00') AT TIME ZONE 'Europe/Warsaw')`;
  // poza oknem 12 tygodni: liczy się do "zużyte", ale nie do średniej ani wykresu
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${A}, ${s}, 4, now() - interval '200 days')`;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, created_at) VALUES (${A}, ${s}, 'Statystyki', 5, now() - interval '30 days')`;
  // cudze i z innej odmiany nie mogą się wliczyć
  await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${B}, ${s}, 50), (${A}, ${other}, 7)`;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams) VALUES (${B}, ${s}, 'Statystyki', 100), (${A}, ${other}, 'Inna', 20)`;

  const st = await strainStats(A, s);
  assert.equal(st.bought, 15);
  assert.equal(st.purchases, 2);
  assert.equal(st.used, 6);
  assert.equal(st.uses, 3);
  assert.equal(st.lastDaysAgo, 0);
  assert.match(st.lastUse, /^\d{4}-\d{2}-\d{2}$/);
  // 2 g w oknie / 10 dni (od 9 dni temu do dziś włącznie)
  assert.equal(st.perDay, 0.2);
  assert.equal(st.weeks.length, 12);
  assert.equal(Math.round(st.weeks.reduce((a, w) => a + w.grams, 0) * 100) / 100, 2);
  assert.equal(st.weeks.at(-1).grams >= 0.5, true);

  // bartek widzi tylko swoje
  const sb = await strainStats(B, s);
  assert.equal(sb.used, 50);
  assert.equal(sb.bought, 100);
});

test('tygodnie liczone w czasie polskim (poniedziałek 00:30 w Polsce to bieżący tydzień)', { skip }, async () => {
  const { ania: A } = ids;
  const s = await create(A, 'Strefa');
  // 00:30 w poniedziałek czasu polskiego to jeszcze niedziela w UTC: przy liczeniu w UTC wpadłoby do poprzedniego tygodnia
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at)
          VALUES (${A}, ${s}, 1, (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') + interval '30 minutes') AT TIME ZONE 'Europe/Warsaw')`;
  const [{ week }] = await q`SELECT to_char(date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw'), 'YYYY-MM-DD') AS week`;
  const st = await strainStats(A, s);
  assert.equal(st.weeks.at(-1).week, week);
  assert.equal(st.weeks.at(-1).grams, 1);
  assert.equal(st.weeks.at(-2).grams, 0);
});
