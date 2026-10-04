// Eksport CSV dziennika (GET /api/account/export/csv): tylko własne dane, jednostki g/ml, czas polski, formuły, BOM, zakres dat.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession;
const ids = {}, strain = {};

async function get(uid, query = '', cookie = '') {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import('../../app/api/account/export/csv/route.js');
  const req = new Request(`http://localhost/api/account/export/csv${query}`, { headers: cookie ? { cookie } : {} });
  const res = await mod.GET(req, { params: Promise.resolve({}) });
  return { status: res.status, res, text: res.headers.get('content-type')?.startsWith('text/csv') ? new TextDecoder('utf-8', { ignoreBOM: true }).decode(await res.arrayBuffer()) : null };
}
const lines = (t) => t.replace(/^﻿/, '').trimEnd().split('\r\n');

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
  const mk = async (name, form) => (await q`INSERT INTO strains (name, producer, type, form, created_by) VALUES (${name}, 'P', 'haze', ${form}, ${ids.ania}) RETURNING id`)[0].id;
  strain.susz = await mk('Susz Haze', 'susz');
  strain.olej = await mk('=HYPERLINK("x")', 'olej');
  const A = ids.ania, B = ids.bartek;
  // 2026-06-30 22:30 UTC = 2026-07-01 00:30 w Polsce (lato, UTC+2): data ma być polska
  await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${A}, ${strain.susz}, 0.5, '2026-06-30T22:30:00Z'), (${A}, ${strain.olej}, 0.25, '2026-07-02T10:00:00Z'), (${B}, ${strain.susz}, 9, '2026-07-02T10:00:00Z')`;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, created_at) VALUES (${A}, ${strain.susz}, 'Susz Haze', 10, 123.45, '2026-07-03T08:00:00Z'), (${A}, NULL, '+usunięta', 5, NULL, '2026-07-04T08:00:00Z'), (${B}, ${strain.susz}, 'Susz Haze', 99, 1, '2026-07-03T08:00:00Z')`;
  await q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note) VALUES (${A}, '2026-07-02', 3, 7, NULL, 8, '@cmd; "cytat"'), (${B}, '2026-07-02', 9, 9, 9, 9, 'cudzy sekret')`;
});

after(async () => { if (pool) await pool.end(); });

test('wymaga logowania', { skip }, async () => {
  assert.equal((await get(null)).status, 401);
});

test('plik: BOM, nagłówki, średnik, no-store i neutralna nazwa', { skip }, async () => {
  const { res, text } = await get(ids.ania);
  assert.equal(res.status, 200);
  assert.ok(text.startsWith('﻿'), 'BOM');
  assert.equal(lines(text)[0], 'Typ;Data;Godzina;Odmiana;Ilość;Jednostka;Koszt zł;Ból;Sen;Lęk;Nastrój;Notatka');
  assert.match(res.headers.get('cache-control'), /no-store/);
  assert.match(res.headers.get('content-disposition'), /filename="zielnik-dziennik-\d{4}-\d{2}-\d{2}\.csv"/);
  const d = await get(ids.ania, '', 'a=b; zielnik_discreet=1');
  const cd = d.res.headers.get('content-disposition');
  assert.match(cd, /filename="notatnik-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.doesNotMatch(cd, /zielnik|konop|cannabis|susz/i);
});

test('tylko własne dane, jednostki g/ml, przecinek dziesiętny, czas polski', { skip }, async () => {
  const { text } = await get(ids.ania);
  assert.doesNotMatch(text, /cudzy|;99;|;9;9;9/);
  const l = lines(text);
  assert.equal(l.length, 1 + 5);
  assert.equal(l[1], 'Zużycie;2026-07-01;00:30;Susz Haze;0,5;g;;;;;;');
  assert.equal(l[2], 'Zużycie;2026-07-02;12:00;"\'=HYPERLINK(""x"")";0,25;ml;;;;;;');
  assert.equal(l[3], 'Objawy;2026-07-02;;;;;;3;7;;8;"\'@cmd; ""cytat"""');
  assert.equal(l[4], 'Zakupy;2026-07-03;10:00;Susz Haze;10;g;123,45;;;;;');
  assert.equal(l[5], 'Zakupy;2026-07-04;10:00;\'+usunięta;5;g;;;;;;');
});

test('formuły: komórki tekstowe zaczynające się od = + - @ mają apostrof', { skip }, async () => {
  const { text } = await get(ids.ania);
  assert.match(text, /;"'=HYPERLINK/);
  assert.match(text, /"'@cmd/);
  assert.match(text, /;'\+usunięta/);
});

test('filtry: typ i zakres dat', { skip }, async () => {
  assert.equal(lines((await get(ids.ania, '?typ=zakupy')).text).length, 3);
  assert.ok(lines((await get(ids.ania, '?typ=zuzycie')).text).slice(1).every((x) => x.startsWith('Zużycie;')));
  assert.equal(lines((await get(ids.ania, '?od=2026-07-02&do=2026-07-03')).text).length, 1 + 3);
  assert.equal((await get(ids.ania, '?od=jutro')).status, 400);
  assert.equal((await get(ids.ania, '?typ=hasla')).status, 400);
});

test('konto bez wpisów: sam nagłówek', { skip }, async () => {
  const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES ('celina', 'x', false) RETURNING id`;
  assert.equal(lines((await get(u.id)).text).length, 1);
});
