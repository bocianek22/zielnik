// POM-16: powiązanie zakupów z receptą: nakładające się recepty bez podwójnego liczenia, auto-wybór recepty,
// cudza recepta, usunięcie recepty (SET NULL -> rezerwa), czas zapisu z kolejki offline (at), korekta w Historii, eksport i kopia.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

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

const day = (offset) => new Date(Date.now() + offset * 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
const mkStrain = async (uid, f = {}) => (await call(uid, 'strains', 'POST', { type: 'haze', producer: 'Aurora', ...f })).json.id;
const buy = (uid, id, grams, extra = {}) => call(uid, 'strains/[id]/purchase', 'POST', { grams, requestId: randomUUID(), ...extra }, { id: String(id) });
const addRx = async (uid, grams, validOffset, extra = {}) => {
  const r = await call(uid, 'prescriptions', 'POST', { issuedOn: day(-20), validUntil: day(validOffset), grams, ...extra });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return [...r.json.prescriptions].sort((a, b) => b.id - a.id)[0].id;
};
const boughtOf = async (uid, rxId) => (await call(uid, 'prescriptions', 'GET')).json.prescriptions.find((p) => p.id === rxId).bought;
const linkOf = async (purchaseId) => (await q`SELECT prescription_id FROM purchases WHERE id = ${purchaseId}`)[0].prescription_id;

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
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek', 'celina', 'dorota', 'edyta']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('ensureDb: kolumna prescription_id (ON DELETE SET NULL) i ponowne uruchomienie bez błędów', { skip }, async () => {
  const { ensureDb } = await import('../../lib/db.js');
  await ensureDb();
  const [c] = await q`SELECT is_nullable, (SELECT confdeltype FROM pg_constraint WHERE conrelid = 'purchases'::regclass AND contype = 'f'
                      AND confrelid = 'prescriptions'::regclass) AS del
                      FROM information_schema.columns WHERE table_name = 'purchases' AND column_name = 'prescription_id'`;
  assert.equal(c.is_nullable, 'YES');
  assert.equal(c.del, 'n');
});

test('dwie nakładające się recepty: zakupy nie liczą się podwójnie, auto-wybór wg najbliższego terminu', { skip }, async () => {
  const A = ids.ania;
  const s = await mkStrain(A, { name: 'Overlap' });
  const soon = await addRx(A, 10, 5); // wygasa wcześniej
  const later = await addRx(A, 10, 30);
  const r1 = await buy(A, s, 6);
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.equal(r1.json.prescriptionId, soon);
  assert.equal(await boughtOf(A, soon), 6);
  assert.equal(await boughtOf(A, later), 0, 'zakup przypisany do pierwszej recepty nie liczy się do drugiej');
  const r2 = await buy(A, s, 4);
  assert.equal(r2.json.prescriptionId, soon);
  // pierwsza wykupiona w całości -> kolejny zakup idzie na drugą
  const r3 = await buy(A, s, 3);
  assert.equal(r3.json.prescriptionId, later);
  assert.equal(await boughtOf(A, soon), 10);
  assert.equal(await boughtOf(A, later), 3);
  // jawny wybór innej recepty niż domyślna
  const early = await addRx(A, 5, 2);
  const r4 = await buy(A, s, 1, { prescriptionId: later });
  assert.equal(r4.json.prescriptionId, later);
  assert.equal(await boughtOf(A, early), 0);
  assert.equal(await boughtOf(A, later), 4);
  // null = bez recepty
  const r5 = await buy(A, s, 2, { prescriptionId: null });
  assert.equal(r5.json.prescriptionId, null);
});

test('zakupy bez powiązania: stary szacunek jako rezerwa, bez podwójnego liczenia przypisanych', { skip }, async () => {
  const B = ids.bartek;
  const s = await mkStrain(B, { name: 'Rezerwa' });
  const p1 = await addRx(B, 20, 10);
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams) VALUES (${B}, ${s}, 'Rezerwa', 7)`;
  assert.equal(await boughtOf(B, p1), 7);
  const r = await buy(B, s, 5, { prescriptionId: p1 });
  assert.equal(r.status, 200);
  assert.equal(await boughtOf(B, p1), 12);
  // druga recepta o pasującym okresie: dostaje rezerwę (7), ale nie gramy przypisane do pierwszej (5)
  const p2 = await addRx(B, 20, 15);
  assert.equal(await boughtOf(B, p2), 7);
  assert.equal(await boughtOf(B, p1), 12);
  // zakup przypisany liczy się do swojej recepty bez względu na datę
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, prescription_id, created_at) VALUES (${B}, ${s}, 'Rezerwa', 2, ${p1}, now() - interval '100 days')`;
  assert.equal(await boughtOf(B, p1), 14);
});

test('inna jednostka: auto-wybór pomija receptę w ml dla suszu, jawna recepta w ml daje 400', { skip }, async () => {
  const A = ids.ania;
  const s = await mkStrain(A, { name: 'Susz G' });
  const ml = await addRx(A, 30, 3, { unit: 'ml' });
  const r = await buy(A, s, 1);
  assert.notEqual(r.json.prescriptionId, ml);
  const bad = await buy(A, s, 1, { prescriptionId: ml });
  assert.equal(bad.status, 400);
  assert.equal(await boughtOf(A, ml), 0);
});

test('cudza recepta: 404, zakup się nie zapisuje; błędny identyfikator: 400', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  const s = await mkStrain(B, { name: 'Cudza' });
  const rxA = await addRx(A, 10, 7);
  const bought0 = await boughtOf(A, rxA); // rezerwa z wcześniejszych zakupów bez powiązania
  const n0 = (await q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${B}`)[0].n;
  const r = await buy(B, s, 2, { prescriptionId: rxA });
  assert.equal(r.status, 404, JSON.stringify(r.json));
  assert.equal((await q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${B}`)[0].n, n0);
  assert.equal(await boughtOf(A, rxA), bought0);
  assert.equal((await buy(B, s, 2, { prescriptionId: 'abc' })).status, 400);
  assert.equal((await buy(B, s, 2, { prescriptionId: 0 })).status, 400);
  // korekta w Historii nie przypisze cudzej recepty do własnego zakupu
  const own = await buy(B, s, 1, { prescriptionId: null });
  const p = await call(B, 'history/purchases/[id]', 'PATCH', { prescriptionId: rxA }, { id: String(own.json.id) });
  assert.equal(p.status, 404);
  assert.equal(await linkOf(own.json.id), null);
});

test('usunięcie recepty: zakupy wracają do rezerwy (SET NULL), nie znikają', { skip }, async () => {
  const A = ids.ania;
  const s = await mkStrain(A, { name: 'Usuwana' });
  const gone = await addRx(A, 10, 4);
  const r = await buy(A, s, 3, { prescriptionId: gone });
  assert.equal(await linkOf(r.json.id), gone);
  const d = await call(A, 'prescriptions', 'DELETE', { id: gone });
  assert.equal(d.status, 200);
  assert.equal(await linkOf(r.json.id), null);
  assert.equal((await q`SELECT count(*)::int AS n FROM purchases WHERE id = ${r.json.id}`)[0].n, 1);
  const fresh = await addRx(A, 10, 9);
  assert.ok((await boughtOf(A, fresh)) >= 3, 'zakup bez powiązania liczy się jako rezerwa nowej recepty');
});

test('zapis z kolejki offline (at): recepta wybierana wg dnia zakupu, a nie dnia wysłania', { skip }, async () => {
  const A = ids.celina; // osobne konto: bez recept i zakupów z innych testów
  const s = await mkStrain(A, { name: 'Offline', form: 'olej' }); // olej = ml
  const old = (await call(A, 'prescriptions', 'POST', { issuedOn: day(-10), validUntil: day(-1), grams: 50, unit: 'ml' })).json.prescriptions
    .sort((a, b) => b.id - a.id)[0].id;
  const cur = await addRx(A, 50, 20, { unit: 'ml' });
  const at = new Date(Date.now() - 60 * 3600000).toISOString(); // 2,5 doby temu: recepta `old` była jeszcze ważna
  const r = await buy(A, s, 5, { at });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.prescriptionId, old);
  assert.equal(await boughtOf(A, cur), 0);
  const now = await buy(A, s, 5);
  assert.equal(now.json.prescriptionId, cur);
  // powtórzony requestId nie dubluje i oddaje to samo powiązanie
  const rid = randomUUID();
  const a = await buy(A, s, 2, { requestId: rid });
  const b = await buy(A, s, 2, { requestId: rid });
  assert.equal(b.json.id, a.json.id);
  assert.equal(b.json.prescriptionId, a.json.prescriptionId);
});

test('Historia: zmiana i usunięcie powiązania zakupu; zmiana nie rusza stanu', { skip }, async () => {
  const A = ids.ania;
  const s = await mkStrain(A, { name: 'Korekta' });
  const r1 = await addRx(A, 100, 40);
  const r2 = await addRx(A, 100, 50);
  const p = await buy(A, s, 5, { prescriptionId: r1 });
  const stock = async () => Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${s} AND user_id = ${A}`)[0].current_amount);
  const st0 = await stock();
  const up = await call(A, 'history/purchases/[id]', 'PATCH', { prescriptionId: r2 }, { id: String(p.json.id) });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  assert.equal(up.json.prescriptionId, r2);
  assert.equal(await linkOf(p.json.id), r2);
  assert.equal(await stock(), st0);
  const rm = await call(A, 'history/purchases/[id]', 'PATCH', { prescriptionId: null }, { id: String(p.json.id) });
  assert.equal(rm.status, 200);
  assert.equal(await linkOf(p.json.id), null);
  await call(A, 'history/purchases/[id]', 'PATCH', { prescriptionId: r1 }, { id: String(p.json.id) });
  const g = await call(A, 'history/purchases/[id]', 'PATCH', { grams: 6 }, { id: String(p.json.id) });
  assert.equal(g.status, 200);
  assert.equal(await linkOf(p.json.id), r1, 'zmiana gramów zachowuje powiązanie');
  const { history } = await import('../../lib/strains.js');
  assert.equal((await history(A)).purchases.find((x) => x.id === p.json.id).prescriptionId, r1);
});

test('eksport konta i kopia zawierają powiązanie', { skip }, async () => {
  const A = ids.ania;
  const s = await mkStrain(A, { name: 'Eksport' });
  const rx = await addRx(A, 10, 6);
  await buy(A, s, 1, { prescriptionId: rx });
  const ex = await call(A, 'account/export', 'GET');
  assert.equal(ex.status, 200);
  assert.ok(ex.json.purchases.some((p) => p.prescriptionId === rx));
  assert.ok(ex.json.prescriptions.some((p) => p.id === rx));
  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.ok(b.purchases.some((p) => p.prescription_id === rx));
});

test('powtórzony requestId z kolejki po usunięciu recepty: ten sam wynik, bez błędu i bez duplikatu', { skip }, async () => {
  const C = ids.celina;
  const s = await mkStrain(C, { name: 'Kolejka' });
  const rx = await addRx(C, 10, 8);
  const requestId = randomUUID();
  const r1 = await buy(C, s, 2, { requestId, prescriptionId: rx, at: Date.now() - 60000 });
  assert.equal(r1.status, 200);
  assert.equal(r1.json.prescriptionId, rx);
  await call(C, 'prescriptions', 'DELETE', { id: rx });
  const r2 = await buy(C, s, 2, { requestId, prescriptionId: rx, at: Date.now() - 60000 });
  assert.equal(r2.status, 200, JSON.stringify(r2.json)); // wcześniej 404 przed obsługą duplikatu
  assert.equal(r2.json.id, r1.json.id);
  assert.equal((await q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${C} AND request_id = ${requestId}`)[0].n, 1);
  // także bez `at`: duplikat jest sprawdzany przed receptą
  const r3 = await buy(C, s, 2, { requestId, prescriptionId: rx });
  assert.equal(r3.status, 200);
  assert.equal(r3.json.id, r1.json.id);
});

test('zapis z kolejki z receptą cudzą, nieistniejącą albo w innej jednostce: zakup się zapisuje (tryb auto), cudza nie zostaje przypisana', { skip }, async () => {
  const A = ids.ania, C = ids.celina;
  const s = await mkStrain(C, { name: 'Kolejka 2' });
  const rxA = await addRx(A, 10, 7);
  const ml = await addRx(C, 30, 3, { unit: 'ml' });
  const at = Date.now() - 60000;
  const foreign = await buy(C, s, 1, { prescriptionId: rxA, at });
  assert.equal(foreign.status, 200, JSON.stringify(foreign.json));
  assert.notEqual(foreign.json.prescriptionId, rxA);
  assert.equal((await buy(C, s, 1, { prescriptionId: 2147483000, at })).status, 200);
  const unit = await buy(C, s, 1, { prescriptionId: ml, at });
  assert.equal(unit.status, 200);
  assert.notEqual(unit.json.prescriptionId, ml);
  // bez `at` (zapis interaktywny) błędy zostają
  assert.equal((await buy(C, s, 1, { prescriptionId: rxA })).status, 404);
});

test('jawne „bez recepty” (prescriptionId: null) nie liczy się w rezerwie żadnej recepty; brak pola = auto', { skip }, async () => {
  const B = ids.dorota;
  const s = await mkStrain(B, { name: 'Prywatny' });
  const rx = await addRx(B, 50, 12);
  const before = await boughtOf(B, rx);
  const priv = await buy(B, s, 4, { prescriptionId: null });
  assert.equal(priv.status, 200);
  assert.equal(priv.json.prescriptionId, null);
  assert.equal((await q`SELECT no_rx FROM purchases WHERE id = ${priv.json.id}`)[0].no_rx, true);
  assert.equal(await boughtOf(B, rx), before); // wcześniej +4 z rezerwy
  const auto = await buy(B, s, 3);
  assert.equal(auto.json.prescriptionId, rx);
  assert.equal(await boughtOf(B, rx), before + 3);
  // Historia: bez przypisania <-> bez recepty <-> konkretna
  const patch = (body) => call(B, 'history/purchases/[id]', 'PATCH', body, { id: String(priv.json.id) });
  assert.equal((await patch({ prescriptionId: null })).status, 200);
  assert.equal(await boughtOf(B, rx), before + 3 + 4); // wróciło do rezerwy
  const np = await patch({ noRx: true });
  assert.equal(np.json.noRx, true);
  assert.equal(await boughtOf(B, rx), before + 3);
  assert.equal((await patch({ prescriptionId: rx })).json.noRx, false);
  assert.equal(await boughtOf(B, rx), before + 3 + 4);
  await patch({ noRx: true });
  const { history } = await import('../../lib/strains.js');
  assert.equal((await history(B)).purchases.find((x) => x.id === priv.json.id).noRx, true);
  const ex = await call(B, 'account/export', 'GET');
  assert.ok(ex.json.purchases.some((p) => p.noRx === true));
});

test('lista recept podaje część wykupu liczoną z szacunku; opcje Historii zawierają starszą przypisaną receptę', { skip }, async () => {
  const A = ids.celina;
  const s = await mkStrain(A, { name: 'Szacunek' });
  const rx = await addRx(A, 100, 30);
  const est0 = (await call(A, 'prescriptions', 'GET')).json.prescriptions.find((p) => p.id === rx).estimated;
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams) VALUES (${A}, ${s}, 'Szacunek', 6)`;
  await buy(A, s, 5, { prescriptionId: rx });
  const row = (await call(A, 'prescriptions', 'GET')).json.prescriptions.find((p) => p.id === rx);
  assert.equal(row.estimated, est0 + 6);
  assert.equal(row.bought, row.estimated + 5);
  // 31 nowszych recept wypycha starą poza LIMIT 30, ale przypisanie do widocznego zakupu ją zachowuje
  const { prescriptionOptions } = await import('../../lib/strains.js');
  for (let i = 0; i < 31; i++) await q`INSERT INTO prescriptions (user_id, issued_on, grams) VALUES (${A}, CURRENT_DATE + 1, 1)`;
  assert.ok((await prescriptionOptions(A)).some((p) => p.id === rx));
});

test('auto-wybór pomija receptę wyczerpaną (pozostało 0)', { skip }, async () => {
  const B = ids.edyta;
  const s = await mkStrain(B, { name: 'Wyczerpana' });
  const full = await addRx(B, 1, 5);
  const free = await addRx(B, 100, 20);
  await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, prescription_id) VALUES (${B}, ${s}, 'Wyczerpana', 1, ${full})`;
  const r = await buy(B, s, 2);
  assert.equal(r.json.prescriptionId, free);
});
