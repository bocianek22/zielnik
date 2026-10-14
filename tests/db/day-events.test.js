// Znaczniki zdarzeń na wykresie objawów (POM-53): wizyty i zakupy (nowa partia osobno) z okna, bez przyszłych wizyt,
// tylko własne dane, same daty (bez notatek i ilości), pole `events` w GET /api/symptoms.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db (baza WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, dayEvents, addDaysIso, todayPL;
const ids = {};

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
  ({ dayEvents } = await import('../../lib/day-events.js'));
  ({ addDaysIso, todayPL } = await import('../../lib/date.js'));
  await db.ensureDb();
  q = db.sql();
  // rejestracja przez API (zgody), bo GET /api/symptoms bez nich odpowiada 403
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  const reg = await import('../../app/api/auth/register/route.js');
  for (const n of ['ania', 'bartek']) {
    jar.clear();
    const res = await reg.POST(new Request('http://localhost/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true }) }));
    assert.equal(res.status, 200);
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('zdarzenia: wizyty i zakupy z okna, nowa partia, bez przyszłych wizyt i cudzych danych', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const t = todayPL(), d3 = addDaysIso(t, -3), d10 = addDaysIso(t, -10), old = addDaysIso(t, -90);
  await q`INSERT INTO visits (user_id, day, note) VALUES (${A}, ${d3}::date, ''), (${A}, ${old}::date, ''), (${A}, ${addDaysIso(t, 20)}::date, ''), (${B}, ${d10}::date, '')`;
  // created_at w południe czasu polskiego danego dnia
  const at = (d) => `${d} 12:00:00 Europe/Warsaw`;
  await q`INSERT INTO purchases (user_id, strain_name, grams, created_at) VALUES (${A}, 'X', 5, ${at(d3)}::timestamptz)`;
  await q`INSERT INTO purchases (user_id, strain_name, grams, created_at, batch_no) VALUES (${A}, 'X', 10, ${at(d10)}::timestamptz, 'P-1')`;
  await q`INSERT INTO purchases (user_id, strain_name, grams, created_at) VALUES (${B}, 'Y', 5, ${at(d3)}::timestamptz)`;
  // drugi zakup tej samej partii (d5) to zwykły zakup, nie „nowa partia”
  const d5 = addDaysIso(t, -5);
  await q`INSERT INTO purchases (user_id, strain_name, grams, created_at, batch_no) VALUES (${A}, 'X', 10, ${at(d5)}::timestamptz, 'P-1')`;

  // zdarzenia niepożądane (POM-62): tylko dzień, bez nasilenia i opisu; cudze i spoza okna pominięte
  const d1 = addDaysIso(t, -1);
  await q`INSERT INTO adverse_events (user_id, day, severity, note) VALUES (${A}, ${d3}::date, 'silne', ''), (${A}, ${d1}::date, 'lagodne', ''),
    (${A}, ${old}::date, 'lagodne', ''), (${B}, ${d5}::date, 'silne', '')`;

  const ev = await dayEvents(A, 60);
  assert.deepEqual(ev, [
    { day: d10, visit: false, purchase: true, batch: true, adverse: false },
    { day: d5, visit: false, purchase: true, batch: false, adverse: false },
    { day: d3, visit: true, purchase: true, batch: false, adverse: true },
    { day: d1, visit: false, purchase: false, batch: false, adverse: true },
  ]);
  assert.deepEqual((await dayEvents(B, 60)).map((e) => e.day), [d10, d5, d3]);

  jar.clear(); await createSession(A);
  const mod = await import('../../app/api/symptoms/route.js');
  const res = await mod.GET(new Request('http://localhost/api/symptoms'));
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).events, ev);
});
