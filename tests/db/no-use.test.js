// POM-38 „Dzień bez zużycia”: oznaczanie, walidacja, zdjęcie znacznika przez zapis zużycia, obserwacje (tylko dni
// potwierdzone, gdy ktoś oznacza), eksport JSON i CSV, kopia, prywatność.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, observations, backup;
const ids = {};
let S, today, d = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, json: type.includes('json') ? await res.json() : null, text: type.includes('csv') ? await res.text() : null };
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
  ({ observations } = await import('../../lib/observations.js'));
  backup = await import('../../lib/backup.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  [{ id: S }] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Nu', 'P', 'haze', 'susz') RETURNING id`;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${S}, ${ids.ania}, 10)`;
  const [r] = await q`SELECT to_char(t, 'YYYY-MM-DD') AS today, to_char(t - 1, 'YYYY-MM-DD') AS d1, to_char(t - 2, 'YYYY-MM-DD') AS d2,
    to_char(t - 3, 'YYYY-MM-DD') AS d3, to_char(t - 31, 'YYYY-MM-DD') AS old, to_char(t + 1, 'YYYY-MM-DD') AS fut
    FROM (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS t) x`;
  today = r.today; d = r;
});

after(async () => { if (pool) await pool.end(); });

test('oznaczanie: dziś i wstecz do 30 dni; przyszłość, za stare, zła data i dzień ze zużyciem odrzucone; wymaga zalogowania', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(null, 'usage/none', 'POST', {})).status, 401);
  const r = await call(A, 'usage/none', 'POST', {});
  assert.equal(r.status, 200);
  assert.equal(r.json.day, today);
  assert.equal((await call(A, 'usage/none', 'POST', { day: today })).status, 200); // powtórka bez błędu
  assert.equal((await call(A, 'usage/none', 'POST', { day: d.fut })).status, 400);
  assert.equal((await call(A, 'usage/none', 'POST', { day: d.old })).status, 400);
  assert.equal((await call(A, 'usage/none', 'POST', { day: '2026-13-45' })).status, 400);
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${A}, ${S}, 0.2, ${d.d1}::date + interval '12 hours')`;
  assert.equal((await call(A, 'usage/none', 'POST', { day: d.d1 })).status, 409);
  const rows = await q`SELECT to_char(day, 'YYYY-MM-DD') AS day FROM no_use_days WHERE user_id = ${A}`;
  assert.deepEqual(rows.map((x) => x.day), [today]);
});

test('zapis „Zużyłem” zdejmuje znacznik z tego dnia; cofnięcie znacznika działa tylko na własne dni', { skip }, async () => {
  const A = ids.ania;
  assert.equal((await call(A, `strains/[id]/usage`, 'POST', { grams: 0.3 }, { id: String(S) })).status, 200);
  assert.equal((await q`SELECT 1 FROM no_use_days WHERE user_id = ${A} AND day = ${today}::date`).length, 0);
  assert.equal((await call(A, 'usage/none', 'POST', { day: d.d2 })).status, 200);
  assert.equal((await call(ids.bartek, 'usage/none', 'DELETE', { day: d.d2 })).status, 200); // Bartek nic nie usuwa u Ani
  assert.equal((await q`SELECT 1 FROM no_use_days WHERE user_id = ${A} AND day = ${d.d2}::date`).length, 1);
  assert.equal((await call(A, 'usage/none', 'DELETE', { day: d.d2 })).status, 200);
  assert.equal((await q`SELECT 1 FROM no_use_days WHERE user_id = ${A} AND day = ${d.d2}::date`).length, 0);
});

test('obserwacje: bez oznaczeń „bez zużycia” to każdy dzień bez wpisu; po pierwszym oznaczeniu tylko dni potwierdzone', { skip }, async () => {
  const B = ids.bartek;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${S}, ${B}, 5)`;
  // zużycie 3 dni temu (pierwszy wpis), objawy codziennie od tego dnia do dziś
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${B}, ${S}, 0.2, ${d.d3}::date + interval '12 hours')`;
  for (const day of [d.d3, d.d2, d.d1, today]) await q`INSERT INTO symptom_log (user_id, day, pain) VALUES (${B}, ${day}::date, 5)`;
  let o = await observations(B, 30);
  assert.equal(o.confirmedNoUse, false);
  assert.equal(o.symptoms.pain.none.days, 3);
  assert.equal((await call(B, 'usage/none', 'POST', { day: d.d2 })).status, 200);
  o = await observations(B, 30);
  assert.equal(o.confirmedNoUse, true);
  assert.equal(o.symptoms.pain.none.days, 1);
  assert.equal(o.symptoms.pain.strains[0].days, 1);
});

test('eksport JSON i CSV, kopia, usunięcie konta', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  assert.equal((await call(A, 'usage/none', 'POST', { day: d.d3 })).status, 200);
  const j = (await call(A, 'account/export', 'GET')).json;
  assert.deepEqual(j.noUseDays, [d.d3]);
  const lines = (await call(A, 'account/export/csv', 'GET')).text.replace(/^﻿/, '').trimEnd().split('\r\n');
  assert.ok(lines.some((l) => l.startsWith(`Bez zużycia;${d.d3};`)));
  assert.ok(!lines.some((l) => l.includes(`Bez zużycia;${d.d2}`))); // dzień Bartka nie trafia do eksportu Ani
  const b = await backup.buildBackup();
  assert.ok(b.no_use_days.some((x) => x.user_id === A));
  await q`DELETE FROM users WHERE id = ${B}`;
  assert.equal((await q`SELECT 1 FROM no_use_days WHERE user_id = ${B}`).length, 0);
});
