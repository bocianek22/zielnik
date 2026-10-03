// Jednostki: susz w gramach, olej i pen w ml. Pule, recepty, statystyki, raport, przypomnienia, eksport i kopia
// liczą gramy i ml osobno. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PWD = 'startowe-haslo';

let q, jar, pool, createSession;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  if (!mod[method]) return { status: 405, json: null, text: null };
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

const create = async (uid, f) => {
  const r = await call(uid, 'strains', 'POST', { type: 'haze', ...f });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.id;
};
const setEntry = async (uid, id, body) => {
  const r = await call(uid, 'strains/[id]/entry', 'PUT', body, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
};
const use = async (uid, id, grams) => {
  const r = await call(uid, 'strains/[id]/usage', 'POST', { grams }, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json;
};
const buy = async (uid, id, grams) => {
  const r = await call(uid, 'strains/[id]/purchase', 'POST', { grams }, { id: String(id) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json;
};
const keyOf = async (id) => (await q`SELECT pool_key(id, producer, thc, cbd, form) AS k FROM strains WHERE id = ${id}`)[0].k;
const poolOf = async (uid, id) => Number((await q`SELECT p.remaining_to_buy FROM user_pool p JOIN strains s ON p.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd, s.form)
                                                  WHERE s.id = ${id} AND p.user_id = ${uid}`)[0]?.remaining_to_buy ?? 0);

// Zimny start w nowym procesie (pełna migracja, gdy suma schematu się nie zgadza)
function coldStart() {
  const code = `
    const { pool } = await import('./tests/db/neon-shim.mjs');
    const { ensureDb } = await import('./lib/db.js');
    try { await ensureDb(); console.log('ok'); } finally { await pool.end(); }`;
  return new Promise((resolve, reject) => {
    execFile(process.execPath, ['--experimental-default-type=module', '--import', './tests/db/register.mjs', '--input-type=module', '-e', code],
      { cwd: ROOT, env: { ...process.env, DATABASE_URL: URL_, BOCIAN_INITIAL_PASSWORD: PWD } },
      (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)));
  });
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= PWD;
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek', 'celina', 'darek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('SQL: form_unit i strain_unit (zakup bez odmiany = gramy)', { skip }, async () => {
  const [r] = await q`SELECT form_unit('susz') AS s, form_unit('olej') AS o, form_unit('pen') AS p, form_unit(NULL) AS n, strain_unit(NULL) AS x, strain_unit(-1) AS y`;
  assert.deepEqual(r, { s: 'g', o: 'ml', p: 'ml', n: 'g', x: 'g', y: 'g' });
});

test('pula „do wykupienia”: olej nie łączy się z suszem o tym samym producencie i stężeniu', { skip }, async () => {
  const A = ids.ania;
  const susz = await create(A, { name: 'Pula Susz', producer: 'Aurora', thc: 20, cbd: 1 });
  const susz2 = await create(A, { name: 'Pula Susz 2', producer: 'Aurora', thc: 20, cbd: 1 });
  const olej = await create(A, { name: 'Pula Olej', producer: 'Aurora', thc: 20, cbd: 1, form: 'olej' });
  const pen = await create(A, { name: 'Pula Pen', producer: 'Aurora', thc: 20, cbd: 1, form: 'pen' });
  assert.equal(await keyOf(susz), await keyOf(susz2)); // susz dalej w jednej puli
  assert.notEqual(await keyOf(susz), await keyOf(olej));
  assert.notEqual(await keyOf(olej), await keyOf(pen));
  // klucz suszu bez zmian względem wersji 4-argumentowej (stary kod na wspólnej bazie)
  assert.equal((await q`SELECT pool_key(id, producer, thc, cbd) AS k FROM strains WHERE id = ${susz}`)[0].k, await keyOf(susz));

  await setEntry(A, susz, { remaining: 10 });
  await setEntry(A, olej, { remaining: 30 });
  assert.equal(await poolOf(A, susz2), 10);
  assert.equal(await poolOf(A, olej), 30);
  assert.equal(await poolOf(A, pen), 0);

  const b1 = await buy(A, olej, 10);
  assert.equal(b1.remaining, 20);
  assert.equal(await poolOf(A, susz), 10);
  await buy(A, susz2, 4);
  assert.equal(await poolOf(A, susz), 6);
  assert.equal(await poolOf(A, olej), 20);

  // listStrains: osobne pule na liście (StrainsBoard grupuje po pool_key)
  const { listStrains } = await import('../../lib/strains.js');
  const list = await listStrains(A, { ids: [susz, susz2, olej] });
  const by = Object.fromEntries(list.map((s) => [s.id, s]));
  assert.equal(by[susz].pool_key, by[susz2].pool_key);
  assert.notEqual(by[susz].pool_key, by[olej].pool_key);
  assert.equal(by[olej].entries.find((e) => e.userId === A).remaining, 20);
});

test('zmiana postaci susz → olej przenosi pulę pod klucz oleju', { skip }, async () => {
  const A = ids.ania;
  const s = await create(A, { name: 'Zmiana Postaci', producer: 'Tilray', thc: 10, cbd: 10 });
  await setEntry(A, s, { remaining: 15 });
  const before = await keyOf(s);
  const r = await call(A, 'strains/[id]', 'PATCH', { name: 'Zmiana Postaci', producer: 'Tilray', type: 'haze', thc: 10, cbd: 10, form: 'olej' }, { id: String(s) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.notEqual(await keyOf(s), before);
  assert.equal(await poolOf(A, s), 15);
  assert.equal((await q`SELECT count(*)::int AS n FROM user_pool WHERE pool_key = ${before}`)[0].n, 0);
});

test('migracja: pule olejów i penów kopiowane pod nowe klucze, stare wiersze zostają', { skip }, async () => {
  const B = ids.bartek;
  const [o] = await q`INSERT INTO strains (producer, name, type, thc, cbd, form) VALUES ('Medalchemy', 'Migr Olej', 'haze', 10, 0.5, 'olej') RETURNING id`;
  const [s] = await q`INSERT INTO strains (producer, name, type, thc, cbd) VALUES ('Medalchemy', 'Migr Susz', 'haze', 10, 0.5) RETURNING id`;
  const oldKey = (await q`SELECT pool_key(id, producer, thc, cbd) AS k FROM strains WHERE id = ${o.id}`)[0].k;
  await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy) VALUES (${B}, ${oldKey}, 7)`;
  // stan sprzed zmiany: bez wersji 5-argumentowej, inna suma schematu
  await q`DROP FUNCTION pool_key(integer, text, numeric, numeric, text)`;
  await q`UPDATE schema_meta SET value = 'stara' WHERE key = 'schema'`;
  await coldStart();
  assert.equal(await poolOf(B, o.id), 7);
  assert.equal(await poolOf(B, s.id), 7); // susz z tym samym starym kluczem zachowuje wartość (pula była wspólna)
  assert.equal((await q`SELECT remaining_to_buy::float8 AS v FROM user_pool WHERE user_id = ${B} AND pool_key = ${oldKey}`)[0].v, 7);
  // drugi start nie kopiuje ponownie (zmiana w puli oleju zostaje)
  await q`UPDATE user_pool SET remaining_to_buy = 3 WHERE user_id = ${B} AND pool_key = ${await keyOf(o.id)}`;
  await q`UPDATE schema_meta SET value = 'stara' WHERE key = 'schema'`;
  await coldStart();
  assert.equal(await poolOf(B, o.id), 3);
});

test('recepty: jednostka, wykup tylko z zakupów tej samej jednostki, zakup bez odmiany = gramy', { skip }, async () => {
  const C = ids.celina;
  const { todayPL, addDaysIso } = await import('../../lib/date.js');
  const d = todayPL();
  const susz = await create(C, { name: 'Rx Susz', producer: 'S-Lab', thc: 22 });
  const olej = await create(C, { name: 'Rx Olej', producer: 'S-Lab', thc: 5, form: 'olej' });
  let r = await call(C, 'prescriptions', 'POST', { issuedOn: addDaysIso(d, -5), validUntil: addDaysIso(d, 3), grams: 20 });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  r = await call(C, 'prescriptions', 'POST', { issuedOn: addDaysIso(d, -5), validUntil: addDaysIso(d, 4), grams: 30, unit: 'ml' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  await buy(C, susz, 5);
  await buy(C, olej, 10);
  await q`INSERT INTO purchases (user_id, strain_name, grams) VALUES (${C}, 'usunięta', 2)`;
  r = await call(C, 'prescriptions', 'GET');
  const byUnit = Object.fromEntries(r.json.prescriptions.map((p) => [p.unit, p]));
  assert.equal(byUnit.g.bought, 7);
  assert.equal(byUnit.ml.bought, 10);

  const { prescriptionCountdown } = await import('../../lib/stats.js');
  const { prescriptionAlerts } = await import('../../lib/strains.js');
  const cd = await prescriptionCountdown(C);
  assert.deepEqual(cd.items.map((i) => [i.unit, i.remaining]).sort(), [['g', 13], ['ml', 20]]);
  const al = await prescriptionAlerts(C);
  assert.deepEqual(al.map((i) => [i.unit, i.remaining]).sort(), [['g', 13], ['ml', 20]]);

  // nieznana jednostka z formularza = gramy
  r = await call(C, 'prescriptions', 'POST', { issuedOn: d, grams: 1, unit: 'kg' });
  assert.equal(r.json.prescriptions.find((p) => p.grams === 1).unit, 'g');
});

test('statystyki: dzienne zużycie, wykres 14 dni, wykup i podsumowanie miesiąca osobno dla g i ml', { skip }, async () => {
  const D = ids.darek;
  const susz = await create(D, { name: 'St Susz', producer: 'Aurora', thc: 18 });
  const olej = await create(D, { name: 'St Olej', producer: 'Aurora', thc: 18, form: 'olej' });
  await setEntry(D, susz, { current: 10 });
  await setEntry(D, olej, { current: 30 });
  await use(D, susz, 1);
  await use(D, olej, 0.5);
  await use(D, olej, 0.25);
  await buy(D, olej, 30);
  await buy(D, susz, 5);

  const { dailyUse, purchaseStats, monthlyRecap, history } = await import('../../lib/strains.js');
  const { dailyUsageSeries } = await import('../../lib/stats.js');
  const du = await dailyUse(D);
  assert.equal(du.perDay, 1);
  assert.equal(du.perDayMl, 0.75);
  const series = await dailyUsageSeries(D, 14);
  assert.deepEqual({ grams: series.at(-1).grams, ml: series.at(-1).ml }, { grams: 1, ml: 0.75 });
  const ps = await purchaseStats(D);
  assert.equal(ps.grams, 5);
  assert.equal(ps.ml, 30);
  const mr = await monthlyRecap(D);
  assert.equal(mr.totalGrams, 1);
  assert.equal(mr.totalMl, 0.75);
  assert.equal(mr.topStrain.unit, 'g');
  const h = await history(D);
  assert.deepEqual([...new Set(h.usage.map((u) => `${u.name}:${u.unit}`))].sort(), ['St Olej:ml', 'St Susz:g']);
  assert.deepEqual(h.purchases.map((p) => p.unit).sort(), ['g', 'ml']);
  assert.equal(h.weekly.at(-1).grams, 1);
  assert.equal(h.weekly.at(-1).ml, 0.75);

  // dziennik objawów: zużycie dzienne z osobną kolumną ml
  const r = await call(D, 'symptoms', 'GET');
  const today = r.json.usage.at(-1);
  assert.equal(today.grams, 1);
  assert.equal(today.ml, 0.75);

  // raport dla lekarza: sumy osobno
  const { doctorReport } = await import('../../lib/report.js');
  const { todayPL, addDaysIso } = await import('../../lib/date.js');
  const rep = await doctorReport(D, addDaysIso(todayPL(), -30), todayPL());
  assert.deepEqual(rep.totals.used, { g: 1, ml: 0.75 });
  assert.deepEqual(rep.totals.bought, { g: 5, ml: 30 });
  assert.deepEqual(rep.usage.map((u) => [u.name, u.unit, u.grams]), [['St Susz', 'g', 1], ['St Olej', 'ml', 0.75]]);
  assert.deepEqual({ g: rep.weekly.at(-1).used_g, ml: rep.weekly.at(-1).used_ml }, { g: 1, ml: 0.75 });
});

test('przypomnienie o zapasie osobno dla g i ml; treść z jednostką', { skip }, async () => {
  const D = ids.darek;
  const push = await import('../../lib/push.js');
  await q`INSERT INTO push_subscriptions (user_id, endpoint) VALUES (${D}, 'https://push.example/units')`;
  // stan po teście statystyk: susz 14 g przy 1 g/dzień, olej 59,25 ml przy 0,75 ml/dzień -> brak przypomnień przy progu 5 dni
  assert.deepEqual(await push.dueReminders({ userId: D }), []);
  await q`UPDATE user_strain SET current_amount = 2 WHERE user_id = ${D}`;
  const due = await push.dueReminders({ userId: D });
  const items = due[0].items.filter((i) => i.type === 'stock').map((i) => [i.key, i.unit, i.total, i.daysLeft]).sort();
  assert.deepEqual(items, [['stock', 'g', 2, 2], ['stock:ml', 'ml', 2, 2]]);
  const body = push.buildPayload(due[0].items, true).body;
  assert.match(body, /Zapas wystarczy na ok\. 2 dni \(2 g\)/);
  assert.match(body, /Zapas oleju\/pena wystarczy na ok\. 2 dni \(2 ml\)/);
  assert.match(push.buildPayload([{ type: 'rx', validUntil: '2026-10-08', daysLeft: 3, remaining: 20, unit: 'ml' }], true).body, /zostało 20 ml do wykupienia/);
});

test('eksport danych i kopia zawierają jednostki', { skip }, async () => {
  const A = ids.ania;
  await call(A, 'prescriptions', 'POST', { issuedOn: '2026-01-10', grams: 30, unit: 'ml' });
  const olej = (await q`SELECT id FROM strains WHERE name = 'Pula Olej'`)[0].id;
  await use(A, olej, 0.5);
  const r = await call(A, 'account/export', 'GET');
  assert.equal(r.status, 200);
  const data = JSON.parse(r.text);
  assert.equal(data.prescriptions.find((p) => p.grams === 30).unit, 'ml');
  assert.ok(data.usage.some((u) => u.strain === 'Pula Olej' && u.unit === 'ml'));
  assert.ok(data.purchases.some((p) => p.strain === 'Pula Olej' && p.unit === 'ml'));
  assert.ok(data.purchases.some((p) => p.strain === 'Pula Susz 2' && p.unit === 'g'));
  assert.deepEqual([...new Set(data.remainingToBuy.map((p) => p.unit))].sort(), ['g', 'ml']);
  assert.ok(data.entries.some((e) => e.strain === 'Pula Olej' && e.unit === 'ml'));

  const csv = await call(A, 'export', 'GET');
  assert.match(csv.text.split('\r\n')[0], /;Jednostka$/);
  assert.match(csv.text, /Pula Olej;.*;ml(\r\n|$)/);

  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.ok(b.prescriptions.some((p) => p.unit === 'ml'));
  assert.ok(b.strains.some((s) => s.form === 'olej'));
});
