// POM-41: import kopii (POST /api/account/import): eksport konta A -> import na konto B, idempotencja, nieufne identyfikatory,
// widoczność, dryRun i szyfrowanie notatek. Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza jest CZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setup, skip } from './harness.mjs';

const savedKey = process.env.DATA_ENCRYPTION_KEY;
const setKey = (v) => { if (v == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = v; };
const D = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

let h, dc, A, B, C, E;
const S = {}; // odmiany
const names = ['ania', 'bartek', 'celina', 'darek', 'ewa'];

before(async () => {
  if (skip) return;
  h = await setup(names);
  dc = await import('../../lib/data-crypto.js');
  ({ ania: A, bartek: B, celina: C, darek: E } = h.ids);
  const { q } = h;
  const strain = async (name, producer, form = 'susz', thc = 20) => (await q`INSERT INTO strains (name, producer, type, form, thc, cbd) VALUES (${name}, ${producer}, 'hybryda', ${form}, ${thc}, 1) RETURNING id`)[0].id;
  S.alfa = await strain('Alfa', 'ProdA');
  S.olej = await strain('Olej X', 'ProdB', 'olej', 10);
  S.gone = await strain('Znikająca', 'ProdC');
  // dwie odmiany o tej samej nazwie (starszy plik bez producenta jest wtedy niejednoznaczny)
  S.w1 = await strain('Wspólna', 'ProdA');
  S.w2 = await strain('Wspólna', 'ProdD');
  // dane konta A (sposób zapisu jak w trasach, z mikrosekundami w czasach)
  await q`INSERT INTO user_strain (strain_id, user_id, rating, rated_at, current_amount, notes, effects, visibility, price_per_g) VALUES
    (${S.alfa}, ${A}, 8.5, '2026-08-01T10:00:00.5Z', 5, 'moja notatka', '{"relax":7,"sleep":3}', 'all', 40),
    (${S.olej}, ${A}, 6, '2026-08-02T10:00:00Z', 10, '', '{}', 'friends', NULL),
    (${S.gone}, ${A}, 3, '2026-08-03T10:00:00Z', 1, 'znika', '{}', 'me', NULL)`;
  const [{ pk }] = await q`SELECT pool_key(id, producer, thc, cbd, form) AS pk FROM strains WHERE id = ${S.alfa}`;
  await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy) VALUES (${A}, ${pk}, 12), (${A}, ${`strain:${S.alfa}`}, 99)`;
  const [p1] = await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams, unit, note) VALUES (${A}, '2026-09-01', '2026-12-01', 100, 'g', 'uwaga recepty') RETURNING id`;
  const [p2] = await q`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams, unit, note) VALUES (${A}, '2026-09-02', NULL, 30, 'ml', '') RETURNING id`;
  S.rx1 = p1.id; S.rx2 = p2.id;
  await q`INSERT INTO usage_log (user_id, strain_id, grams, method, period, created_at) VALUES
    (${A}, ${S.alfa}, 0.5, 'vaporizer', 'morning', '2026-09-03T08:15:00.123456Z'), (${A}, ${S.alfa}, 0.25, NULL, NULL, '2026-09-03T20:00:00Z'),
    (${A}, ${S.olej}, 0.5, 'oil', 'evening', '2026-09-04T20:00:00Z'), (${A}, ${S.gone}, 1, NULL, NULL, '2026-09-05T20:00:00Z')`;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, prescription_id, no_rx, created_at, request_id, pool_delta) VALUES
    (${A}, ${S.alfa}, 'Alfa', 10, 400, ${S.rx1}, false, '2026-09-02T09:00:00.987654Z', 'abc-12345678', 5),
    (${A}, ${S.olej}, 'Olej X', 30, NULL, ${S.rx2}, false, '2026-09-02T10:00:00Z', NULL, NULL),
    (${A}, ${S.alfa}, 'Alfa', 2, 80, NULL, true, '2026-09-06T10:00:00Z', NULL, NULL)`;
  await q`INSERT INTO strain_tests (strain_id, user_id, note, visibility, created_at, mime, data) VALUES
    (${S.alfa}, ${A}, 'test alfa', 'all', '2026-09-07T10:00:00.5Z', NULL, NULL), (${S.olej}, ${A}, 'test olej', 'friends', '2026-09-08T10:00:00Z', NULL, NULL),
    (${S.alfa}, ${A}, 'ze zdjeciem', 'me', '2026-09-09T10:00:00Z', 'image/png', 'AAAA')`;
  await q`INSERT INTO symptom_log (user_id, day, pain, sleep, anxiety, mood, note) VALUES
    (${A}, ${D(3)}, 4, 6, 2, 7, 'dzień 1'), (${A}, ${D(2)}, NULL, 5, NULL, NULL, ''), (${A}, ${D(1)}, 1, 1, 1, 1, 'dzień 3')`;
  const [c1] = await q`INSERT INTO symptom_custom (user_id, slot, name, higher_better) VALUES (${A}, 1, 'Ból głowy', false) RETURNING id`;
  const [c2] = await q`INSERT INTO symptom_custom (user_id, slot, name, higher_better) VALUES (${A}, 2, 'Energia', true) RETURNING id`;
  await q`INSERT INTO symptom_values (custom_id, user_id, day, value) VALUES (${c1.id}, ${A}, ${D(3)}, 3), (${c2.id}, ${A}, ${D(3)}, 8), (${c1.id}, ${A}, ${D(1)}, 0)`;
  await q`INSERT INTO doctor_notes (user_id, text, done, created_at, done_at) VALUES
    (${A}, 'zapytać o dawkę', false, '2026-09-10T10:00:00.123456Z', NULL), (${A}, 'badania', true, '2026-09-01T10:00:00Z', '2026-09-11T10:00:00Z')`;
  await q`INSERT INTO no_use_days (user_id, day) VALUES (${A}, ${D(5)}), (${A}, ${D(4)})`;
  await q`INSERT INTO push_prefs (user_id, notify_prescription, notify_stock, stock_days, notify_hour, show_details, notify_symptoms, symptoms_hour, notify_visit, next_visit_on)
          VALUES (${A}, false, true, 7, 8, true, true, 20, true, ${new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10)})`;
  // dane celiny (cudze wiersze, którym import nie może nic zrobić) i relacje towarzyskie A
  await q`INSERT INTO user_strain (strain_id, user_id, rating, notes) VALUES (${S.alfa}, ${C}, 2, 'celina')`;
  await q`INSERT INTO prescriptions (user_id, issued_on, grams, unit, note) VALUES (${C}, '2026-01-01', 5, 'g', 'cudza recepta')`;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${A}, ${C}, 'accepted')`;
});
after(async () => { setKey(savedKey); if (h) await h.pool.end(); });

const exportOf = async (uid) => (await h.call(uid, 'account/export', 'GET')).json;
const imp = (uid, data, dryRun = false) => h.call(uid, 'account/import', 'POST', { dryRun, data });
const clone = (x) => JSON.parse(JSON.stringify(x));

// Dane własne konta w postaci porównywalnej (notatki odszyfrowane z zakresem danego konta, czasy co do ms)
async function snapshot(uid) {
  const { q } = h;
  const dec = (t, c, scope, v) => dc.decryptField(t, c, scope, v);
  const entries = (await q`SELECT s.name, us.rating::float8 AS rating, us.current_amount::float8 AS cur, us.effects, us.notes, us.price_per_g::float8 AS price, us.strain_id
    FROM user_strain us JOIN strains s ON s.id = us.strain_id WHERE us.user_id = ${uid} ORDER BY s.name`)
    .map((r) => ({ name: r.name, rating: r.rating, cur: r.cur, effects: r.effects, price: r.price, notes: dec('user_strain', 'notes', dc.rowScope('user_strain', { user_id: uid, strain_id: r.strain_id }), r.notes) }));
  const rx = (await q`SELECT id, to_char(issued_on, 'YYYY-MM-DD') AS a, to_char(valid_until, 'YYYY-MM-DD') AS b, grams::float8 AS g, unit, note FROM prescriptions WHERE user_id = ${uid} ORDER BY issued_on`)
    .map((r) => ({ id: r.id, a: r.a, b: r.b, g: r.g, unit: r.unit, note: dec('prescriptions', 'note', dc.rowScope('prescriptions', { user_id: uid, id: r.id }), r.note) }));
  const rxKey = new Map(rx.map((r) => [r.id, `${r.a}|${r.g}`]));
  const t = (col) => `(extract(epoch FROM date_trunc('milliseconds', ${col})) * 1000)::float8`;
  return {
    entries,
    pool: (await q`SELECT pool_key, remaining_to_buy::float8 AS g FROM user_pool WHERE user_id = ${uid} ORDER BY pool_key`).map((r) => `${r.pool_key}=${r.g}`),
    rx: rx.map(({ id: _i, ...r }) => r),
    usage: await q.query(`SELECT s.name, l.grams::float8 AS g, l.method, usage_period(l.period, l.created_at) AS period, ${t('l.created_at')} AS t FROM usage_log l JOIN strains s ON s.id = l.strain_id WHERE l.user_id = $1 ORDER BY l.created_at, l.grams`, [uid]),
    purchases: (await q.query(`SELECT s.name, p.grams::float8 AS g, p.cost::float8 AS c, p.prescription_id AS rx, p.no_rx, ${t('p.created_at')} AS t FROM purchases p JOIN strains s ON s.id = p.strain_id WHERE p.user_id = $1 ORDER BY p.created_at`, [uid]))
      .map(({ rx: id, ...r }) => ({ ...r, rx: id ? rxKey.get(id) : null })),
    tests: (await q.query(`SELECT t.id, s.name, t.note, ${t('t.created_at')} AS t FROM strain_tests t JOIN strains s ON s.id = t.strain_id WHERE t.user_id = $1 ORDER BY t.created_at`, [uid]))
      .map((r) => ({ name: r.name, t: r.t, note: dec('strain_tests', 'note', dc.rowScope('strain_tests', { id: r.id }), r.note) })),
    symptoms: (await q`SELECT to_char(day, 'YYYY-MM-DD') AS d, pain, sleep, anxiety, mood, note FROM symptom_log WHERE user_id = ${uid} ORDER BY day`)
      .map((r) => ({ ...r, note: dec('symptom_log', 'note', dc.rowScope('symptom_log', { user_id: uid, day: r.d }), r.note) })),
    custom: await q`SELECT slot, name, higher_better FROM symptom_custom WHERE user_id = ${uid} ORDER BY slot`,
    values: await q`SELECT to_char(v.day, 'YYYY-MM-DD') AS d, c.name, v.value FROM symptom_values v JOIN symptom_custom c ON c.id = v.custom_id WHERE v.user_id = ${uid} ORDER BY v.day, c.name`,
    notes: await q.query(`SELECT text, done, ${t('created_at')} AS t FROM doctor_notes WHERE user_id = $1 ORDER BY text`, [uid]),
    noUse: (await q`SELECT to_char(day, 'YYYY-MM-DD') AS d FROM no_use_days WHERE user_id = ${uid} ORDER BY day`).map((r) => r.d),
    prefs: await q`SELECT notify_prescription, notify_stock, stock_days, notify_hour, show_details, notify_symptoms, symptoms_hour, notify_visit, next_visit_on::text AS v FROM push_prefs WHERE user_id = ${uid}`,
  };
}
const counts = async () => (await h.q`SELECT
  (SELECT count(*)::int FROM strains) AS strains, (SELECT count(*)::int FROM user_strain) AS us, (SELECT count(*)::int FROM usage_log) AS usage,
  (SELECT count(*)::int FROM purchases) AS purchases, (SELECT count(*)::int FROM strain_tests) AS tests, (SELECT count(*)::int FROM prescriptions) AS rx,
  (SELECT count(*)::int FROM symptom_log) AS sym, (SELECT count(*)::int FROM symptom_custom) AS custom, (SELECT count(*)::int FROM symptom_values) AS vals,
  (SELECT count(*)::int FROM doctor_notes) AS notes, (SELECT count(*)::int FROM no_use_days) AS nouse, (SELECT count(*)::int FROM user_pool) AS pool,
  (SELECT count(*)::int FROM push_prefs) AS prefs, (SELECT count(*)::int FROM friendships) AS fr, (SELECT count(*)::int FROM group_members) AS gm`)[0];

let FILE, SNAP_A;

test('eksport zawiera producenta przy zużyciu, zakupach i testach (stabilne dopasowanie po nazwie i producencie)', { skip }, async () => {
  FILE = await exportOf(A);
  assert.equal(FILE.usage[0].producer, 'ProdA');
  assert.equal(FILE.purchases[0].producer, 'ProdA');
  assert.equal(FILE.tests[0].producer, 'ProdA');
  assert.equal(FILE.entries.length, 3);
  // odmiana znika z katalogu po eksporcie: wiersze o niej nie mają jak trafić na nowe konto
  await h.q`DELETE FROM strains WHERE id = ${S.gone}`;
  SNAP_A = await snapshot(A);
  // klucz `strain:<id>` (zależny od id odmiany w bazie źródłowej) nie jest przenoszony; pora zużycia bywa wyliczana z godziny (usage_period)
  SNAP_A.pool = SNAP_A.pool.filter((k) => !k.startsWith('strain:'));
  assert.equal(SNAP_A.entries.length, 2);
});

test('dryRun: podsumowanie bez zapisu, a po nim właściwy import daje to samo podsumowanie', { skip }, async () => {
  const before = await counts();
  const r = await imp(B, FILE, true);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.dryRun, true);
  assert.deepEqual(await counts(), before, 'dryRun nic nie zapisuje');
  const sec = Object.fromEntries(r.json.sections.map((s) => [s.key, s]));
  assert.equal(sec.entries.added, 2, JSON.stringify(r.json)); assert.equal(sec.entries.missing, 1);
  assert.equal(sec.usage.added, 3); assert.equal(sec.usage.missing, 1);
  assert.equal(sec.purchases.added, 3); assert.equal(sec.tests.added, 3);
  const M = JSON.stringify(r.json); assert.equal(sec.prescriptions.added, 2, M); assert.equal(sec.symptoms.added, 3, M); assert.equal(sec.custom.added, 2, M);
  assert.equal(sec.pool.added, 1);
  assert.equal(sec.pool.invalid, 1, 'klucz strain:<id> odpada już przy walidacji');
  assert.equal(sec.prefs.added, 1);
  assert.equal(r.json.unmatched[0].name, 'Znikająca');
  assert.ok(r.json.notes.some((t) => /Zdjęcia nie są przenoszone \(1\)/.test(t)));
  assert.ok(r.json.notImported.includes('znajomi'));
  assert.equal((await h.q`SELECT count(*)::int AS n FROM user_strain WHERE user_id = ${B}`)[0].n, 0);

  const real = await imp(B, FILE);
  assert.equal(real.status, 200, JSON.stringify(real.json));
  assert.equal(real.json.dryRun, false);
  assert.deepEqual(real.json.sections, r.json.sections, 'podsumowanie z dryRun = wynik importu');
});

test('import na konto B daje te same dane własne co u A (bez odmiany, której nie ma w katalogu)', { skip }, async () => {
  const b = await snapshot(B);
  assert.deepEqual(b, SNAP_A);
  assert.equal(b.usage.length, 3);
  assert.equal(b.purchases.find((p) => p.g === 10).rx, '2026-09-01|100', 'zakup wskazuje NOWĄ receptę B (mapowanie starych id)');
  assert.equal(b.purchases.find((p) => p.g === 2).no_rx, true);
  // pula tylko z klucza odmiany katalogowej; klucza `strain:<id>` nie przenosimy
  assert.equal(b.pool.length, 1); assert.ok(!b.pool[0].startsWith('strain:'));
  assert.equal(b.tests.length, 3, 'test ze zdjęciem wchodzi jako sam opis');
});

test('widoczność: wpisy i testy B są prywatne mimo „all” / „friends” w pliku', { skip }, async () => {
  assert.equal((await h.q`SELECT count(*)::int AS n FROM user_strain WHERE user_id = ${B} AND visibility <> 'me'`)[0].n, 0);
  assert.equal((await h.q`SELECT count(*)::int AS n FROM strain_tests WHERE user_id = ${B} AND visibility <> 'me'`)[0].n, 0);
  // A pokazuje wpis wszystkim, B nikomu: celina (znajoma A, nie B) nie widzi wpisu B
  const [v] = await h.q`SELECT can_see(${C}::int, ${B}::int, visibility) AS ok FROM user_strain WHERE user_id = ${B} AND strain_id = ${S.alfa}`;
  assert.equal(v.ok, false);
  // import nie dotyka historii „Cofnij” ani stanu: wpisy z request_id/stock_delta/pool_delta nie powstają
  assert.equal((await h.q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${B} AND (request_id IS NOT NULL OR pool_delta IS NOT NULL)`)[0].n, 0);
  assert.equal((await h.q`SELECT count(*)::int AS n FROM usage_log WHERE user_id = ${B} AND (request_id IS NOT NULL OR stock_delta IS NOT NULL)`)[0].n, 0);
  assert.equal((await h.q`SELECT current_amount::float8 AS c FROM user_strain WHERE user_id = ${B} AND strain_id = ${S.alfa}`)[0].c, 5, 'stan tylko z wpisu odmiany, bez odejmowania zużycia');
});

test('ponowny import tego samego pliku niczego nie dubluje (B oraz źródłowe A)', { skip }, async () => {
  const before = await counts();
  for (const uid of [B, A]) {
    const dry = await imp(uid, FILE, true);
    assert.equal(dry.json.total.added, 0, `dryRun uid=${uid}`);
    const r = await imp(uid, FILE);
    assert.equal(r.status, 200);
    assert.equal(r.json.total.added, 0);
    assert.ok(r.json.total.existing > 10);
  }
  assert.deepEqual(await counts(), before);
  assert.deepEqual(await snapshot(B), SNAP_A);
});

test('obce identyfikatory z pliku niczego nie nadpisują ani nie podpinają', { skip }, async () => {
  const [cRx] = await h.q`SELECT id FROM prescriptions WHERE user_id = ${C}`;
  const [{ pk }] = await h.q`SELECT pool_key(id, producer, thc, cbd, form) AS pk FROM strains WHERE id = ${S.alfa}`;
  const f = clone(FILE);
  // zakup wskazuje receptę celiny, której id znamy z jej konta; pula ma klucz po id odmiany; wiersze z kluczami „id”
  f.purchases = [{ ...f.purchases[0], prescriptionId: cRx.id, created_at: '2026-09-20T10:00:00.000Z', id: C, user_id: C, userId: C }];
  f.prescriptions = [{ ...f.prescriptions[0], id: cRx.id, issued_on: '2026-02-02', user_id: C }];
  f.remainingToBuy = [{ pool_key: `strain:${S.alfa}`, grams: 77 }, { pool_key: pk, grams: 55 }, { pool_key: 'obcy|1|1', grams: 5 }];
  f.entries = f.entries.map((e) => ({ ...e, strain_id: S.alfa, user_id: C, rating: 1 }));
  f.symptoms = []; f.usage = []; f.tests = []; f.customSymptoms = []; f.customSymptomValues = []; f.doctorNotes = []; f.noUseDays = [];
  const cBefore = { us: await h.q`SELECT * FROM user_strain WHERE user_id = ${C}`, rx: await h.q`SELECT * FROM prescriptions WHERE user_id = ${C}`, pool: await h.q`SELECT * FROM user_pool WHERE user_id = ${C}` };
  const r = await imp(E, f); // darek: czyste konto
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual({ us: await h.q`SELECT * FROM user_strain WHERE user_id = ${C}`, rx: await h.q`SELECT * FROM prescriptions WHERE user_id = ${C}`, pool: await h.q`SELECT * FROM user_pool WHERE user_id = ${C}` }, cBefore);
  const rows = await h.q`SELECT id, user_id, prescription_id FROM purchases WHERE user_id = ${E}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, E);
  const [mine] = await h.q`SELECT id FROM prescriptions WHERE user_id = ${E}`;
  assert.notEqual(mine.id, cRx.id, 'nowa recepta dostaje nowe id');
  assert.equal(rows[0].prescription_id, mine.id, 'zakup trafia na NOWĄ receptę darka, nie na receptę celiny');
  assert.deepEqual((await h.q`SELECT pool_key, remaining_to_buy::float8 AS g FROM user_pool WHERE user_id = ${E}`).map((p) => [p.pool_key, p.g]), [[pk, 55]]);
  assert.equal((await h.q`SELECT rating::float8 AS r FROM user_strain WHERE user_id = ${E} AND strain_id = ${S.alfa}`)[0].r, 1);
  // zakup bez pasującej recepty w pliku: bez przypisania (nie bierzemy id z pliku)
  const g = clone(f);
  g.purchases = [{ ...f.purchases[0], created_at: '2026-09-21T10:00:00.000Z', prescriptionId: 999999 }];
  g.prescriptions = [];
  assert.equal((await imp(E, g)).status, 200);
  assert.equal((await h.q`SELECT prescription_id FROM purchases WHERE user_id = ${E} AND created_at = '2026-09-21T10:00:00Z'`)[0].prescription_id, null);
});

test('dane innych osób i relacje nie trafiają: znajomi, grupy, zgody, sesje, zgłoszenia', { skip }, async () => {
  const f = clone(FILE);
  f.friends = [{ username: 'celina', status: 'accepted' }, { username: 'bartek', status: 'accepted' }];
  f.groups = [{ name: 'g', role: 'owner', status: 'active' }]; f.blocked = [{ username: 'celina' }];
  f.profile = { ...f.profile, username: 'hacker', email: 'x@example.com', is_admin: true }; f.is_admin = true;
  f.sessions = [{ device: 'x' }]; f.consentLog = [{ version: 'x' }]; f.reportsFiled = [{ type: 'strain', reason: 'x' }];
  const before = await counts();
  const [u0] = await h.q`SELECT id, username, is_admin, email, password_hash FROM users WHERE id = ${B}`;
  const r = await imp(B, f);
  assert.equal(r.status, 200);
  assert.deepEqual(await counts(), before);
  assert.deepEqual((await h.q`SELECT id, username, is_admin, email, password_hash FROM users WHERE id = ${B}`)[0], u0);
  for (const k of ['znajomi', 'grupy', 'blokady', 'profil, e-mail i zgody', 'zalogowane urządzenia', 'zgłoszenia i uwagi']) assert.ok(r.json.notImported.includes(k), k);
  assert.equal((await h.q`SELECT count(*)::int AS n FROM strains`)[0].n, 4, 'katalog bez zmian: nic nie tworzymy');
});

test('walidacja: zły format, złe typy, długości, daty i zakresy', { skip }, async () => {
  for (const bad of [{ a: 1 }, { exportedAt: 'x' }, { exportedAt: 'x', entries: 'nie lista' }]) {
    const r = await imp(B, bad, true);
    assert.equal(r.status, 400, JSON.stringify(bad));
  }
  assert.equal((await h.call(B, 'account/import', 'POST', 'null')).status, 400);
  assert.equal((await h.call(B, 'account/import', 'POST', '{zepsuty')).status, 400);
  assert.equal((await h.call(null, 'account/import', 'POST', { data: FILE })).status, 401);
  const f = {
    exportedAt: new Date().toISOString(),
    usage: [
      { strain: 'Alfa', producer: 'ProdA', grams: 1001, unit: 'g', created_at: '2026-09-01T10:00:00Z' }, // za dużo
      { strain: 'Alfa', producer: 'ProdA', grams: 'abc', unit: 'g', created_at: '2026-09-01T10:00:00Z' },
      { strain: 'Alfa', producer: 'ProdA', grams: 1, unit: 'g', created_at: 'wczoraj' },
      { strain: 'Alfa', producer: 'ProdA', grams: 1, unit: 'g', created_at: '1999-01-01T00:00:00Z' },
      { strain: 'Alfa', producer: 'ProdA', grams: 1, unit: 'g', created_at: new Date(Date.now() + 10 * 864e5).toISOString() },
      { strain: 'Alfa', producer: 'ProdA', grams: 1, unit: 'ml', created_at: '2026-09-01T10:00:00Z' }, // jednostka niezgodna z postacią
      { strain: 'Alfa', producer: 'ProdA', grams: 1, unit: 'g', created_at: '2026-09-01T10:00:00Z', method: 'dziwna', period: 'x' }, // poprawny wiersz (złe pola opcjonalne = brak)
      { strain: { $ne: 1 }, grams: 1, created_at: '2026-09-01T10:00:00Z' },
      null, 5, 'tekst',
    ],
    symptoms: [{ day: '2026-02-30', pain: 3 }, { day: D(1), pain: 11 }, { day: D(400), pain: 2, note: 'x'.repeat(900) }, { day: '2099-01-01', pain: 1 }],
    prescriptions: [{ id: 1, issued_on: '2026-05-01', valid_until: '2026-04-01', grams: 5, unit: 'g' }, { id: 2, issued_on: '2026-05-01', grams: 0, unit: 'g' }, { id: 3, issued_on: '2026-05-01', grams: 5, unit: 'zł', note: 'n'.repeat(500) }],
    doctorNotes: [{ text: 'x'.repeat(201), createdAt: '2026-09-01T10:00:00Z' }, { text: '   ', createdAt: '2026-09-01T10:00:00Z' }, { text: 'ok\u0000\n punkt', createdAt: '2026-09-01T10:00:00Z' }],
    noUseDays: ['2026-13-01', '2026-09-01', 5],
    entries: [{ strain: 'Alfa', producer: 'ProdA', rating: 99, current_g: -4, notes: 'n'.repeat(5000), price_per_g: 'x', effects: { relax: 50, sleep: 4, hack: 3 } }],
  };
  const dry = await imp(A, f, true);
  assert.equal(dry.status, 200, JSON.stringify(dry.json));
  const sec = Object.fromEntries(dry.json.sections.map((s) => [s.key, s]));
  // zużycie A: wiersz poprawny ma się czas inny niż istniejące, więc jest „do dodania”
  assert.equal(sec.usage.added, 1);
  assert.equal(sec.usage.invalid, 10, 'złe grams/czas/jednostka, nie-obiekty i nazwa nie będąca tekstem');
  const e = h.ids.ewa;
  const real = await imp(e, f);
  assert.equal(real.status, 200);
  const [u] = await h.q`SELECT method, period, grams::float8 AS g FROM usage_log WHERE user_id = ${e}`;
  assert.deepEqual([u.method, u.period, u.g], [null, null, 1]);
  assert.deepEqual((await h.q`SELECT day::text AS d, note FROM symptom_log WHERE user_id = ${e}`).map((r) => r.d), [D(400)]);
  assert.equal(sec.symptoms.invalid, 3);
  const [sl] = await h.q`SELECT note FROM symptom_log WHERE user_id = ${e}`;
  assert.equal(dc.decryptField('symptom_log', 'note', dc.rowScope('symptom_log', { user_id: e, day: D(400) }), sl.note).length, 500, 'notatka przycięta do limitu trasy');
  assert.equal((await h.q`SELECT count(*)::int AS n FROM prescriptions WHERE user_id = ${e}`)[0].n, 1);
  assert.equal(sec.prescriptions.invalid, 2);
  const [rx] = await h.q`SELECT unit, note FROM prescriptions WHERE user_id = ${e}`;
  assert.equal(rx.unit, 'g');
  assert.equal(dc.decryptField('prescriptions', 'note', dc.rowScope('prescriptions', { user_id: e, id: (await h.q`SELECT id FROM prescriptions WHERE user_id = ${e}`)[0].id }), rx.note).length, 120);
  assert.deepEqual((await h.q`SELECT text FROM doctor_notes WHERE user_id = ${e}`).map((r) => r.text), ['ok punkt']);
  assert.deepEqual((await h.q`SELECT day::text AS d FROM no_use_days WHERE user_id = ${e}`).map((r) => r.d), ['2026-09-01']);
  const [en] = await h.q`SELECT rating::float8 AS r, current_amount::float8 AS c, effects, notes, price_per_g FROM user_strain WHERE user_id = ${e}`;
  assert.deepEqual([en.r, en.c, en.effects, en.price_per_g], [null, 0, { sleep: 4 }, null]);
  assert.equal(dc.decryptField('user_strain', 'notes', dc.rowScope('user_strain', { user_id: e, strain_id: S.alfa }), en.notes).length, 1000);
});

test('starszy plik bez producenta: nazwa jednoznaczna łączy się z odmianą, niejednoznaczna jest pomijana, podpowiedź z wpisów rozstrzyga', { skip }, async () => {
  const e = h.ids.ewa;
  await h.q`DELETE FROM rate_limits`;
  await h.q`DELETE FROM usage_log WHERE user_id = ${e}`;
  const f = { exportedAt: new Date().toISOString(), entries: [{ strain: 'Wspólna', producer: 'ProdD', rating: 5 }],
    usage: [{ strain: 'Olej X', grams: 0.5, unit: 'ml', created_at: '2026-10-01T10:00:00Z' }, { strain: 'Wspólna', grams: 1, unit: 'g', created_at: '2026-10-02T10:00:00Z' },
      { strain: 'Nieznana', grams: 1, unit: 'g', created_at: '2026-10-03T10:00:00Z' }] };
  const r = await imp(e, f);
  assert.equal(r.status, 200);
  const u = await h.q`SELECT strain_id FROM usage_log WHERE user_id = ${e} ORDER BY created_at`;
  assert.deepEqual(u.map((x) => x.strain_id), [S.olej, S.w2], 'Wspólna -> ProdD (z wpisu), Nieznana pominięta');
  assert.deepEqual(r.json.unmatched.map((x) => x.name), ['Nieznana']);
  // bez podpowiedzi: dwie odmiany o tej nazwie = pominięcie
  const g = { exportedAt: new Date().toISOString(), usage: [{ strain: 'Wspólna', grams: 1, unit: 'g', created_at: '2026-10-05T10:00:00Z' }] };
  const r2 = await imp(e, g);
  assert.equal(r2.json.total.added, 0);
  assert.equal(r2.json.unmatched[0].name, 'Wspólna');
});

test('limity: 10 otwartych punktów do omówienia, 3 własne objawy, 50 testów na odmianę, rozmiar pliku', { skip }, async () => {
  const e = h.ids.ewa;
  await h.q`DELETE FROM rate_limits`;
  await h.q`DELETE FROM doctor_notes WHERE user_id = ${e}`;
  await h.q`DELETE FROM symptom_custom WHERE user_id = ${e}`;
  const f = { exportedAt: new Date().toISOString(),
    doctorNotes: Array.from({ length: 14 }, (_, i) => ({ text: `punkt ${i}`, done: i >= 12, createdAt: `2026-09-${String(10 + i).padStart(2, '0')}T10:00:00Z` })),
    customSymptoms: ['a', 'b', 'c', 'd', 'A'].map((name) => ({ name })),
    tests: Array.from({ length: 55 }, (_, i) => ({ strain: 'Alfa', producer: 'ProdA', note: `t${i}`, created_at: new Date(Date.UTC(2026, 8, 1, 0, 0, i)).toISOString() })) };
  const r = await imp(e, f);
  const sec = Object.fromEntries(r.json.sections.map((s) => [s.key, s]));
  assert.equal(sec.doctorNotes.added, 12); assert.equal(sec.doctorNotes.limit, 2);
  assert.equal(sec.custom.added, 3); assert.equal(sec.custom.limit, 1);
  assert.equal(sec.tests.added, 50); assert.equal(sec.tests.limit, 5);
  assert.equal((await h.q`SELECT count(*)::int AS n FROM strain_tests WHERE user_id = ${e} AND strain_id = ${S.alfa}`)[0].n, 50);
  const big = await h.call(e, 'account/import', 'POST', JSON.stringify({ data: { exportedAt: 'x', entries: [], pad: 'x'.repeat(5.2 * 1024 * 1024) } }));
  assert.equal(big.status, 413);
});

test('limit prób: podgląd 30/h, zapis 5/h', { skip }, async () => {
  await h.q`DELETE FROM rate_limits`;
  const f = { exportedAt: new Date().toISOString(), entries: [] };
  for (let i = 0; i < 5; i++) assert.equal((await imp(B, f)).status, 200);
  assert.equal((await imp(B, f)).status, 429);
  assert.equal((await imp(B, f, true)).status, 200, 'podgląd ma osobny licznik');
});

test('szyfrowanie: z DATA_ENCRYPTION_KEY notatki trafiają do bazy jako szyfrogram z AAD nowego wiersza; znaczniki i zenc1: są pomijane', { skip }, async () => {
  setKey(`k1:${randomBytes(32).toString('base64')}`);
  try {
    await h.q`DELETE FROM rate_limits`;
    const f = clone(FILE);
    f.entries[1].notes = '[notatka zaszyfrowana, brak klucza]'; // olej: znacznik z wcześniejszego eksportu
    f.symptoms[2].note = 'zenc1:k9:AAAA'; // szyfrogram w pliku nie jest treścią
    f.prescriptions[0].note = 'uwaga recepty';
    const ewaId = h.ids.ewa;
    for (const t of ['user_strain', 'prescriptions', 'strain_tests', 'symptom_log', 'purchases', 'usage_log', 'symptom_values', 'doctor_notes', 'no_use_days', 'symptom_custom']) await h.q.query(`DELETE FROM ${t} WHERE user_id = $1`, [ewaId]);
    await h.q`DELETE FROM push_prefs WHERE user_id = ${ewaId}`;
    const r = await imp(ewaId, f);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    assert.match(r.json.notes.join(' '), /zaszyfrowanych w pliku \(bez treści\): 2/);
    const [us] = await h.q`SELECT notes FROM user_strain WHERE user_id = ${ewaId} AND strain_id = ${S.alfa}`;
    assert.ok(us.notes.startsWith('zenc1:k1:'), 'notatka zaszyfrowana');
    assert.equal(dc.decryptStrict('user_strain', 'notes', dc.rowScope('user_strain', { user_id: ewaId, strain_id: S.alfa }), us.notes), 'moja notatka');
    assert.throws(() => dc.decryptStrict('user_strain', 'notes', dc.rowScope('user_strain', { user_id: A, strain_id: S.alfa }), us.notes), 'AAD nowego konta, nie starego');
    const [rx] = await h.q`SELECT id, note FROM prescriptions WHERE user_id = ${ewaId} AND grams = 100`;
    assert.ok(rx.note.startsWith('zenc1:'));
    assert.equal(dc.decryptStrict('prescriptions', 'note', dc.rowScope('prescriptions', { user_id: ewaId, id: rx.id }), rx.note), 'uwaga recepty');
    const tests = await h.q`SELECT id, note FROM strain_tests WHERE user_id = ${ewaId}`;
    assert.equal(tests.length, 3);
    for (const t of tests) { assert.ok(t.note.startsWith('zenc1:')); assert.ok(dc.decryptStrict('strain_tests', 'note', dc.rowScope('strain_tests', { id: t.id }), t.note).length > 4); }
    const syms = await h.q`SELECT to_char(day, 'YYYY-MM-DD') AS d, note FROM symptom_log WHERE user_id = ${ewaId} ORDER BY day`;
    assert.ok(syms[0].note.startsWith('zenc1:'));
    assert.equal(syms[2].note, '', 'zenc1: z pliku nie trafia jako treść');
    assert.equal((await h.q`SELECT notes FROM user_strain WHERE user_id = ${ewaId} AND strain_id = ${S.olej}`)[0].notes, '', 'znacznik z eksportu nie jest treścią');
    // ponowny import (z tym samym kluczem) też nic nie dubluje
    assert.equal((await imp(ewaId, f)).json.total.added, 0);
    // z kluczem w złym formacie wiersze z notatką są pomijane, reszta wchodzi
    setKey('zly-format');
    const f2 = { exportedAt: new Date().toISOString(), symptoms: [{ day: D(30), pain: 1, note: 'tajne' }, { day: D(31), pain: 2 }] };
    const r3 = await imp(ewaId, f2);
    assert.equal(r3.status, 200);
    assert.equal(r3.json.sections[0].added, 1); assert.equal(r3.json.sections[0].invalid, 1);
    assert.match(r3.json.notes.join(' '), /niedostępny/);
  } finally { setKey(savedKey); }
});
