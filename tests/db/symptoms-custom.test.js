// Własne objawy (POM-07): limit 3, prywatność, wpis wartości, eksport (JSON i CSV), kopia, obserwacje, raport, usuwanie.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, stats, observations, report, backup;
const ids = {};
let today, yesterday;

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
const csv = async (uid) => (await call(uid, 'account/export/csv', 'GET')).text.replace(/^﻿/, '').trimEnd().split('\r\n');

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
  stats = await import('../../lib/stats.js');
  observations = await import('../../lib/observations.js');
  report = await import('../../lib/report.js');
  backup = await import('../../lib/backup.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek']) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  [{ today, yesterday }] = await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS today,
    to_char((now() AT TIME ZONE 'Europe/Warsaw')::date - 1, 'YYYY-MM-DD') AS yesterday`;
});

after(async () => { if (pool) await pool.end(); });

test('limit 3 na konto: czwarty odrzucony, równoległe dodania nie przekraczają limitu', { skip }, async () => {
  const A = ids.ania;
  // 5 równoległych zapisów -> dokładnie 3 wiersze
  const { createCustom } = await import('../../lib/symptoms-custom.js');
  const rs = await Promise.all(['Nudności', 'Apetyt', 'Spastyczność', 'Migrena', 'Energia'].map((name) => createCustom(A, { name, higherBetter: name === 'Apetyt' })));
  assert.equal(rs.filter((r) => r.def).length, 3, JSON.stringify(rs));
  assert.ok(rs.filter((r) => !r.def).every((r) => r.status === 409 && /najwyżej 3/.test(r.error)));
  const [{ n }] = await q`SELECT COUNT(*)::int AS n FROM symptom_custom WHERE user_id = ${A}`;
  assert.equal(n, 3);
  const slots = (await q`SELECT slot FROM symptom_custom WHERE user_id = ${A} ORDER BY slot`).map((r) => r.slot);
  assert.deepEqual(slots, [1, 2, 3]);
  const r4 = await call(A, 'symptoms/custom', 'POST', { name: 'Czwarty' });
  assert.equal(r4.status, 409);
  // porządek do dalszych testów: znane nazwy w miejscach 1-3 (które z równoległych wygrało, jest przypadkowe)
  await q`DELETE FROM symptom_custom WHERE user_id = ${A}`;
  for (const [name, better] of [['Nudności', false], ['Apetyt', true], ['Spastyczność', false]]) assert.equal((await call(A, 'symptoms/custom', 'POST', { name, higherBetter: better })).status, 200);
  // limit jest na konto: Bartek dodaje swój
  assert.equal((await call(ids.bartek, 'symptoms/custom', 'POST', { name: 'Nudności' })).status, 200);
});

test('nazwa: wymagana, do 40 znaków, bez duplikatów (bez względu na wielkość liter), sprzątanie znaków', { skip }, async () => {
  const B = ids.bartek;
  assert.equal((await call(B, 'symptoms/custom', 'POST', { name: '   ' })).status, 400);
  assert.equal((await call(B, 'symptoms/custom', 'POST', { name: 'x'.repeat(41) })).status, 400);
  const dup = await call(B, 'symptoms/custom', 'POST', { name: 'NUDNOŚCI' });
  assert.equal(dup.status, 409);
  assert.match(dup.json.error, /takiej nazwie/);
  const ok = await call(B, 'symptoms/custom', 'POST', { name: '  Apetyt \n  dzienny ', higherBetter: true });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.def.name, 'Apetyt dzienny');
  assert.equal(ok.json.def.higherBetter, true);
  assert.equal((await call(B, 'symptoms/custom', 'POST', { name: 'x'.repeat(40) })).status, 200);
  // zmiana nazwy na istniejącą: 409; poprawna zmiana kierunku zachowuje nazwę
  const [{ id }] = await q`SELECT id FROM symptom_custom WHERE user_id = ${B} AND name = 'Apetyt dzienny'`;
  assert.equal((await call(B, 'symptoms/custom/[id]', 'PATCH', { name: 'nudności' }, { id: String(id) })).status, 409);
  const p = await call(B, 'symptoms/custom/[id]', 'PATCH', { higherBetter: false }, { id: String(id) });
  assert.equal(p.status, 200);
  assert.deepEqual([p.json.def.name, p.json.def.higherBetter], ['Apetyt dzienny', false]);
  await q`DELETE FROM symptom_custom WHERE user_id = ${B} AND name <> 'Nudności'`;
});

test('wpis wartości razem z wbudowanymi; cudze identyfikatory ignorowane; zakres 0-10', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const defs = (await call(A, 'symptoms/custom', 'GET')).json.custom;
  assert.deepEqual(defs.map((d) => d.name), ['Nudności', 'Apetyt', 'Spastyczność']);
  const [n, ap, sp] = defs.map((d) => d.id);
  const bn = (await call(B, 'symptoms/custom', 'GET')).json.custom[0].id;

  let r = await call(A, 'symptoms', 'PUT', { day: today, pain: 4, note: 'x', custom: { [n]: 6, [ap]: 2, [bn]: 9 } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const vals = Object.fromEntries(r.json.customValues.filter((v) => v.day === today).map((v) => [v.id, v.value]));
  assert.deepEqual(vals, { [n]: 6, [ap]: 2 });
  // cudzy identyfikator nie zapisał nic nikomu
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE custom_id = ${bn}`)[0].c, 0);
  // wpis bez pola `custom` (stara kolejka offline) nie rusza wartości; null kasuje jedną
  r = await call(A, 'symptoms', 'PUT', { day: today, pain: 5, note: 'x' });
  assert.equal(r.json.customValues.filter((v) => v.day === today).length, 2);
  r = await call(A, 'symptoms', 'PUT', { day: today, pain: 5, note: 'x', custom: { [n]: null, [sp]: 10 } });
  assert.deepEqual(Object.fromEntries(r.json.customValues.filter((v) => v.day === today).map((v) => [v.id, v.value])), { [ap]: 2, [sp]: 10 });
  assert.equal((await call(A, 'symptoms', 'PUT', { day: today, custom: { [n]: 11 } })).status, 400);
  assert.equal((await call(A, 'symptoms', 'PUT', { day: today, custom: { abc: 1 } })).status, 400);
  // Bartek nie widzi cudzych definicji ani wartości
  const gb = (await call(B, 'symptoms', 'GET')).json;
  assert.deepEqual(gb.custom.map((d) => d.name), ['Nudności']);
  assert.deepEqual(gb.customValues, []);
  // dzień tylko z własnymi wartościami (bez wiersza symptom_log wbudowanych też zapisany jest wiersz, ale wczoraj: zapis częściowy)
  await call(A, 'symptoms', 'PUT', { day: yesterday, custom: { [n]: 3 } });
  // dzisiejszy stan dla panelu „Dziś”
  const t = await stats.todaySymptoms(A);
  assert.deepEqual(t.custom, { [ap]: 2, [sp]: 10 });
  assert.deepEqual(t.defs.map((d) => d.name), ['Nudności', 'Apetyt', 'Spastyczność']);
  assert.equal(t.pain, 5);
  const tb = await stats.todaySymptoms(B);
  assert.deepEqual(tb.defs.map((d) => d.name), ['Nudności']);
  assert.deepEqual(tb.custom, {});
});

test('eksport JSON i CSV: własne objawy i tylko własne dane', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const bn = (await call(B, 'symptoms/custom', 'GET')).json.custom[0].id;
  await call(B, 'symptoms', 'PUT', { day: today, custom: { [bn]: 8 } });
  const ex = (await call(A, 'account/export', 'GET')).json;
  assert.deepEqual(ex.customSymptoms.map((d) => [d.name, d.higherBetter]), [['Nudności', false], ['Apetyt', true], ['Spastyczność', false]]);
  assert.deepEqual(ex.customSymptomValues.filter((v) => v.day === today).map((v) => [v.symptom, v.value]), [['Apetyt', 2], ['Spastyczność', 10]]);
  assert.equal(ex.customSymptomValues.some((v) => v.value === 8), false, 'cudza wartość w eksporcie');
  const lines = await csv(A);
  assert.match(lines[0], /;Notatka;Własne objawy$/);
  assert.ok(lines.some((l) => l.startsWith(`Objawy;${today};`) && l.endsWith('"Apetyt: 2; Spastyczność: 10"')), lines.join('\n'));
  // dzień tylko z własnym objawem też ma wiersz
  assert.ok(lines.some((l) => l.startsWith(`Objawy;${yesterday};`) && l.endsWith('Nudności: 3')));
  assert.equal(lines.some((l) => /Nudności: 8/.test(l)), false);
});

test('kopia zapasowa zawiera obie tabele, a obserwacje i raport traktują własne objawy jak wbudowane', { skip }, async () => {
  const A = ids.ania;
  const b = await backup.buildBackup();
  assert.equal(b.symptom_custom.length, 4); // 3 Ani + 1 Bartka
  assert.ok(b.symptom_values.some((v) => v.user_id === A && v.value === 10));
  const [ap] = (await call(A, 'symptoms/custom', 'GET')).json.custom.filter((d) => d.name === 'Apetyt');
  const [s] = await q`INSERT INTO strains (name, producer, type, form) VALUES ('Obs', 'P', 'haze', 'susz') RETURNING id`;
  for (let i = 0; i < 6; i++) {
    await q`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES (${A}, ${s.id}, 0.3, now() - ${i}::int * interval '1 day')`;
    await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${ap.id}, ${A}, (now() AT TIME ZONE 'Europe/Warsaw')::date - ${i}::int, ${i % 2 ? 4 : 6}::int)
            ON CONFLICT (custom_id, day) DO UPDATE SET value = EXCLUDED.value`;
  }
  const o = await observations.observations(A, 30);
  assert.equal(o.custom.length, 3);
  const g = o.symptoms[`c${ap.id}`];
  assert.equal(g.strains.length, 1);
  assert.ok(g.strains[0].days >= 5 && g.strains[0].avg != null);
  // własne objawy Ani nie wchodzą do obserwacji Bartka
  const ob = await observations.observations(ids.bartek, 30);
  assert.equal(ob.custom.length, 1);
  assert.equal(ob.symptoms[`c${ap.id}`], undefined);
  const to = today, from = new Date(Date.parse(`${today}T12:00:00Z`) - 29 * 864e5).toISOString().slice(0, 10);
  const rep = await report.doctorReport(A, from, to);
  const c = rep.customSym.find((x) => x.name === 'Apetyt');
  assert.ok(c.days >= 6 && c.avg > 0);
  assert.equal(rep.customSym.length, 3);
  assert.equal((await report.doctorReport(ids.bartek, from, to)).customSym.length, 1);
});

test('usunięcie własnego objawu usuwa jego wartości; cudzego nie można usunąć; usunięcie dnia i konta czyści wartości', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const [n] = (await call(A, 'symptoms/custom', 'GET')).json.custom.filter((d) => d.name === 'Nudności');
  assert.ok((await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE custom_id = ${n.id}`)[0].c > 0);
  // cudzy: 404 i nic nie znika
  assert.equal((await call(B, 'symptoms/custom/[id]', 'DELETE', null, { id: String(n.id) })).status, 404);
  assert.equal((await call(B, 'symptoms/custom/[id]', 'PATCH', { name: 'Hak' }, { id: String(n.id) })).status, 404);
  assert.equal((await q`SELECT name FROM symptom_custom WHERE id = ${n.id}`)[0].name, 'Nudności');
  const r = await call(A, 'symptoms/custom/[id]', 'DELETE', null, { id: String(n.id) });
  assert.equal(r.status, 200);
  assert.ok(r.json.removed >= 1);
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE custom_id = ${n.id}`)[0].c, 0);
  assert.equal(r.json.custom.length, 2);
  // zwolnione miejsce można zająć ponownie
  assert.equal((await call(A, 'symptoms/custom', 'POST', { name: 'Nudności 2' })).status, 200);
  // usunięcie dnia kasuje też własne wartości z tego dnia
  const before_ = (await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE user_id = ${A} AND day = ${today}::date`)[0].c;
  assert.ok(before_ > 0);
  await call(A, 'symptoms', 'DELETE', { day: today });
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE user_id = ${A} AND day = ${today}::date`)[0].c, 0);
  // wartości Bartka z tego dnia nietknięte
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE user_id = ${B}`)[0].c, 1);
  // usunięcie konta (kaskada)
  await q`DELETE FROM users WHERE id = ${A}`;
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_custom WHERE user_id = ${A}`)[0].c, 0);
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_values WHERE user_id = ${A}`)[0].c, 0);
  assert.equal((await q`SELECT COUNT(*)::int AS c FROM symptom_custom WHERE user_id = ${B}`)[0].c, 1);
});

test('wymaga zalogowania', { skip }, async () => {
  assert.equal((await call(null, 'symptoms/custom', 'GET')).status, 401);
  assert.equal((await call(null, 'symptoms/custom', 'POST', { name: 'X' })).status, 401);
  assert.equal((await call(null, 'symptoms/custom/[id]', 'DELETE', null, { id: '1' })).status, 401);
});
