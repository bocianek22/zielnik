// POM-32 „Ta partia działała inaczej”: notatka o partii przy zakupie (PUT history/purchases/[id]/batch): zapis, walidacja,
// szyfrowanie, prywatność (cudze id = 404), historia, karta odmiany, eksport JSON/CSV, kopia, raport (tylko z withNotes), import kopii.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setup, skip } from './harness.mjs';

const KEY = `p1:${randomBytes(32).toString('base64')}`;
const KEY2 = `p2:${randomBytes(32).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
const setKey = (v) => { if (v == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = v; };

let h, dc, strains, batches, report, backup, A, B, C, S;
const ROUTE = 'history/purchases/[id]/batch';
const put = (uid, id, body) => h.call(uid, ROUTE, 'PUT', body, { id: String(id) });
const row = async (id) => (await h.q`SELECT batch_no, to_char(batch_expires_on, 'YYYY-MM-DD') AS exp, batch_effect, batch_note, user_id FROM purchases WHERE id = ${id}`)[0];
const buy = async (uid, grams, day) => (await h.q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, created_at)
  VALUES (${uid}, ${S}, 'Alfa', ${grams}, ${grams * 40}, ${day}) RETURNING id`)[0].id;

before(async () => {
  if (skip) return;
  setKey(KEY);
  h = await setup(['ania', 'bartek', 'celina']);
  dc = await import('../../lib/data-crypto.js');
  strains = await import('../../lib/strains.js');
  batches = await import('../../lib/batches.js');
  report = await import('../../lib/report.js');
  backup = await import('../../lib/backup.js');
  ({ ania: A, bartek: B, celina: C } = h.ids);
  [{ id: S }] = await h.q`INSERT INTO strains (name, producer, type, form, thc, cbd) VALUES ('Alfa', 'ProdA', 'hybryda', 'susz', 20, 1) RETURNING id`;
});
after(async () => { setKey(savedKey); if (h) await h.pool.end(); });

test('schemat: kolumny partii istnieją, a notatka jest w zakresie szyfrowania', { skip }, async () => {
  const cols = (await h.q`SELECT column_name FROM information_schema.columns WHERE table_name = 'purchases' AND column_name LIKE 'batch_%' ORDER BY 1`).map((r) => r.column_name);
  assert.deepEqual(cols, ['batch_effect', 'batch_expires_on', 'batch_no', 'batch_note']);
  assert.ok(dc.COLUMNS.some((c) => c.table === 'purchases' && c.col === 'batch_note'), 'notatka partii jest w zakresie szyfrowania');
});

test('zapis: numer, ważność, ocena i notatka; notatka szyfrowana z zakresem konta i zakupu', { skip }, async () => {
  const id = await buy(A, 5, '2026-09-10T10:00:00Z');
  const ok = await put(A, id, { batchNo: ' B-123/26 ', batchExpires: '2027-03-01', batchEffect: 'weaker', batchNote: ' słabsza niż zwykle, mniej aromatu ' });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.deepEqual(ok.json.batch, { id, batchNo: 'B-123/26', batchExpires: '2027-03-01', batchEffect: 'weaker', batchNote: 'słabsza niż zwykle, mniej aromatu' });
  const r = await row(id);
  assert.equal(r.batch_no, 'B-123/26');
  assert.equal(r.exp, '2027-03-01');
  assert.equal(r.batch_effect, 'weaker');
  assert.ok(dc.isEncrypted(r.batch_note), 'notatka w bazie jest szyfrogramem');
  assert.doesNotMatch(r.batch_note, /słabsza/);
  assert.equal(dc.decryptField('purchases', 'batch_note', dc.rowScope('purchases', { user_id: A, id }), r.batch_note), 'słabsza niż zwykle, mniej aromatu');
  // szyfrogramu nie da się odczytać w zakresie innego konta ani innego zakupu
  assert.equal(dc.decryptField('purchases', 'batch_note', dc.rowScope('purchases', { user_id: B, id }), r.batch_note), dc.LOCKED_NOTE);
  assert.equal(dc.decryptField('purchases', 'batch_note', dc.rowScope('purchases', { user_id: A, id: id + 1 }), r.batch_note), dc.LOCKED_NOTE);
  // pominięte batchNote zostawia notatkę, puste ją czyści; ocena i ważność da się wyczyścić
  const keep = await put(A, id, { batchNo: 'B-124', batchExpires: null, batchEffect: 'stronger' });
  assert.equal(keep.status, 200);
  assert.equal(keep.json.batch.batchNote, 'słabsza niż zwykle, mniej aromatu');
  assert.deepEqual([keep.json.batch.batchExpires, keep.json.batch.batchEffect], [null, 'stronger']);
  const clear = await put(A, id, { batchNo: '', batchExpires: '', batchEffect: '', batchNote: '' });
  assert.equal(clear.status, 200);
  assert.deepEqual(await row(id), { batch_no: '', exp: null, batch_effect: null, batch_note: '', user_id: A });
});

test('bez klucza notatka jest jawna; znacznik LOCKED_NOTE nie jest treścią; nieczytelny szyfrogram zostaje przy pustym polu', { skip }, async () => {
  const id = await buy(A, 1, '2026-09-11T10:00:00Z');
  setKey(null);
  try {
    assert.equal((await put(A, id, { batchNote: 'jawna' })).status, 200);
    assert.equal((await row(id)).batch_note, 'jawna');
  } finally { setKey(KEY); }
  // włączone szyfrowanie: kolejny zapis szyfruje; LOCKED_NOTE nie nadpisuje
  assert.equal((await put(A, id, { batchNote: 'tajna' })).status, 200);
  const enc = (await row(id)).batch_note;
  assert.ok(dc.isEncrypted(enc));
  assert.equal((await put(A, id, { batchNote: dc.LOCKED_NOTE, batchNo: 'X1' })).status, 200);
  assert.equal((await row(id)).batch_note, enc, 'znacznik zachowuje notatkę');
  // klucz zniknął: odczyt daje locked, zapis pustego pola nie kasuje szyfrogramu, zapis tekstu przy braku klucza go zastępuje jawnym
  setKey(KEY2);
  try {
    const open = batches.openBatch(A, { id, batchNo: 'X1', batchNote: enc });
    assert.equal(open.batchNote, '');
    assert.equal(open.batchNoteLocked, true);
    assert.equal((await put(A, id, { batchNo: 'X2', batchNote: '' })).status, 200);
    assert.equal((await row(id)).batch_note, enc, 'pusty zapis nie kasuje nieczytelnego szyfrogramu');
    assert.equal((await put(A, id, { batchNo: 'X3' })).json.batch.batchNoteLocked, true);
  } finally { setKey(KEY); }
  assert.equal(batches.openBatch(A, { id, batchNote: enc }).batchNote, 'tajna', 'po powrocie klucza notatka czytelna');
});

test('walidacja: długości, data z kalendarza, nieznana ocena; błędny zapis niczego nie zmienia', { skip }, async () => {
  const id = await buy(A, 2, '2026-09-12T10:00:00Z');
  await put(A, id, { batchNo: 'OK', batchEffect: 'usual', batchNote: 'zostaje' });
  for (const body of [
    { batchNo: 'x'.repeat(41) }, { batchNo: 'a\u0000b' }, { batchExpires: '2027-02-30' }, { batchExpires: '27-01-01' }, { batchExpires: '1999-01-01' },
    { batchEffect: 'najlepsza' }, { batchEffect: 'toString' }, { batchNote: 'y'.repeat(501) },
  ]) {
    const r = await put(A, id, body);
    assert.equal(r.status, 400, JSON.stringify(body).slice(0, 40));
  }
  assert.equal((await put(A, id, { batchNo: 'x'.repeat(40), batchNote: 'y'.repeat(500) })).status, 200);
  const r = await h.call(A, ROUTE, 'PUT', '{zepsute', { id: String(id) });
  assert.equal(r.status, 400);
});

test('prywatność: cudze, nieistniejące i błędne id to 404, bez zmiany danych; bez sesji 401', { skip }, async () => {
  const id = await buy(A, 3, '2026-09-13T10:00:00Z');
  await put(A, id, { batchNo: 'PRYW', batchEffect: 'weaker', batchNote: 'tajemnica ani' });
  const before_ = await row(id);
  for (const uid of [B, C]) {
    const r = await put(uid, id, { batchNo: 'włam', batchEffect: 'stronger', batchNote: 'nadpisane' });
    assert.equal(r.status, 404);
    assert.doesNotMatch(JSON.stringify(r.json), /PRYW|tajemnica/);
  }
  assert.deepEqual(await row(id), before_);
  assert.equal((await put(A, 999999, { batchNo: 'x' })).status, 404);
  assert.equal((await put(A, 'abc', { batchNo: 'x' })).status, 404);
  assert.equal((await put(null, id, { batchNo: 'x' })).status, 401);
  // lista partii odmiany i historia: tylko własne zakupy
  assert.equal((await batches.strainBatches(B, S)).length, 0);
  assert.equal((await strains.history(B)).purchases.length, 0);
  const mine = (await batches.strainBatches(A, S)).find((b) => b.id === id);
  assert.deepEqual([mine.batchNo, mine.batchEffect, mine.batchNote], ['PRYW', 'weaker', 'tajemnica ani']);
  // trasy odmiany i profilu innych użytkowników nie niosą partii
  const others = JSON.stringify((await strains.listStrains(B, { ids: [S] })));
  assert.doesNotMatch(others, /PRYW|tajemnica/);
});

test('Historia i karta odmiany pokazują partie (odszyfrowane), najnowsze zakupy najpierw', { skip }, async () => {
  const id = await buy(A, 7, '2026-09-20T10:00:00Z');
  await put(A, id, { batchNo: 'H-7', batchExpires: '2027-01-15', batchEffect: 'usual', batchNote: 'jak zwykle' });
  const { purchases } = await strains.history(A);
  const p = purchases.find((x) => x.id === id);
  assert.deepEqual([p.batchNo, p.batchExpires, p.batchEffect, p.batchNote], ['H-7', '2027-01-15', 'usual', 'jak zwykle']);
  assert.ok(purchases.every((x) => !('user_id' in x)));
  const list = await batches.strainBatches(A, S);
  assert.equal(list[0].id, id, 'najnowszy zakup pierwszy');
  assert.equal(list[0].batchNote, 'jak zwykle');
  assert.equal(list[0].day, '2026-09-20');
});

test('eksport JSON i CSV zawiera partie odszyfrowane; cudzy eksport ich nie ma', { skip }, async () => {
  const exp = await h.call(A, 'account/export', 'GET');
  assert.equal(exp.status, 200);
  const p = exp.json.purchases.find((x) => x.batchNo === 'H-7');
  assert.deepEqual([p.batchExpires, p.batchEffect, p.batchNote], ['2027-01-15', 'usual', 'jak zwykle']);
  assert.ok(exp.json.purchases.every((x) => !('id' in x) && !('user_id' in x)), 'identyfikatory zakresu nie wyciekają do pliku');
  assert.doesNotMatch(JSON.stringify((await h.call(B, 'account/export', 'GET')).json), /H-7|jak zwykle|PRYW/);
  const csv = (await h.call(A, 'account/export/csv', 'GET', undefined, {}, '?typ=zakupy')).text;
  const line = csv.split('\r\n').find((l) => l.includes('H-7'));
  assert.ok(line, 'wiersz zakupu z partią');
  assert.match(line, /Partia H-7; ważna do 2027-01-15; działanie: jak zwykle; jak zwykle/);
  assert.doesNotMatch((await h.call(B, 'account/export/csv', 'GET', undefined, {}, '?typ=zakupy')).text, /H-7/);
  // zakup bez partii: komórka notatki pusta
  const plain = csv.split('\r\n').filter((l) => l.startsWith('Zakupy;') && !l.includes('Partia'));
  assert.ok(plain.length >= 1);
  assert.ok(plain.every((l) => l.split(';').length === 15 && l.split(';')[13] === ''));
});

test('kopia zapasowa zawiera kolumny partii; notatka jest w niej szyfrogramem i odszyfrowuje się skryptem kopii', { skip }, async () => {
  const data = await backup.buildBackup();
  const r = data.purchases.find((x) => x.batch_no === 'H-7');
  assert.ok(r, 'wiersz z partią w kopii');
  assert.equal(r.batch_effect, 'usual');
  assert.equal(r.batch_expires_on, '2027-01-15');
  assert.ok(dc.isEncrypted(r.batch_note));
  assert.doesNotMatch(JSON.stringify(data), /jak zwykle/);
  const out = dc.decryptBackupData(data);
  assert.equal(out.failed, 0);
  assert.equal(data.purchases.find((x) => x.batch_no === 'H-7').batch_note, 'jak zwykle');
});

test('raport dla lekarza: partie tylko przy withNotes', { skip }, async () => {
  const without = await report.doctorReport(A, '2026-09-15', '2026-09-30');
  const wp = without.purchases.find((x) => x.grams === 7);
  assert.ok(wp, 'zakup w okresie');
  assert.ok(!('batchNo' in wp) && !('batchNote' in wp) && !('id' in wp), 'bez zaznaczenia nic z partii');
  assert.doesNotMatch(JSON.stringify(without), /H-7|jak zwykle/);
  const withN = await report.doctorReport(A, '2026-09-15', '2026-09-30', { withNotes: true });
  const np = withN.purchases.find((x) => x.grams === 7);
  assert.deepEqual([np.batchNo, np.batchEffect, np.batchNote], ['H-7', 'usual', 'jak zwykle']);
  assert.ok(!('id' in np));
  // inny użytkownik nie dostaje cudzych partii nawet z withNotes
  assert.doesNotMatch(JSON.stringify(await report.doctorReport(B, '2026-09-15', '2026-09-30', { withNotes: true })), /H-7/);
  // model PDF/ekranu: opis partii w tabeli zakupów tylko z withNotes
  const { buildReportModel } = await import('../../lib/report-pdf-model.js');
  const model = (r, withNotes) => buildReportModel({ patient: 'ania', from: '2026-09-15', to: '2026-09-30', today: '2026-10-01', withNotes, report: r, minSymptomDays: 5 });
  assert.match(JSON.stringify(model(withN, true)), /Partia H-7/);
  assert.doesNotMatch(JSON.stringify(model(without, false)), /Partia H-7/);
});

test('import kopii: partie przenoszą się na konto B z nowym szyfrowaniem w jego zakresie; ponowny import nic nie dubluje', { skip }, async () => {
  const exp = (await h.call(A, 'account/export', 'GET')).json;
  const data = JSON.parse(JSON.stringify(exp));
  // plik z nieznaną oceną, znacznikiem nieczytelnej notatki i szyfrogramem: pola partii odpadają, zakup zostaje
  data.purchases.push(
    { strain: 'Alfa', producer: 'ProdA', grams: 1.5, unit: 'g', cost: 10, created_at: '2026-09-25T10:00:00.000Z', batchNo: 'Z-9', batchEffect: 'cudowna', batchExpires: '2027-13-01', batchNote: dc.LOCKED_NOTE },
    { strain: 'Alfa', producer: 'ProdA', grams: 2.5, unit: 'g', cost: 10, created_at: '2026-09-26T10:00:00.000Z', batchNote: 'zenc1:p1:AAAA' },
  );
  const dry = await h.call(B, 'account/import', 'POST', { dryRun: true, data });
  assert.equal(dry.status, 200, JSON.stringify(dry.json));
  assert.equal((await h.q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${B}`)[0].n, 0, 'dryRun niczego nie zapisuje');
  const r = await h.call(B, 'account/import', 'POST', { data });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const mine = await h.q`SELECT id, grams::float8 AS g, batch_no, to_char(batch_expires_on, 'YYYY-MM-DD') AS exp, batch_effect, batch_note FROM purchases WHERE user_id = ${B} ORDER BY created_at`;
  assert.equal(mine.length, data.purchases.length);
  const imported = mine.find((x) => x.batch_no === 'H-7');
  assert.equal(imported.exp, '2027-01-15');
  assert.equal(imported.batch_effect, 'usual');
  assert.ok(dc.isEncrypted(imported.batch_note));
  assert.equal(dc.decryptField('purchases', 'batch_note', dc.rowScope('purchases', { user_id: B, id: imported.id }), imported.batch_note), 'jak zwykle');
  assert.equal(dc.decryptField('purchases', 'batch_note', dc.rowScope('purchases', { user_id: A, id: imported.id }), imported.batch_note), dc.LOCKED_NOTE, 'zakres konta B, nie A');
  const z = mine.find((x) => x.batch_no === 'Z-9');
  assert.deepEqual([z.batch_effect, z.exp, z.batch_note], [null, null, ''], 'błędne pola partii odrzucone');
  const e = mine.find((x) => x.g === 2.5);
  assert.deepEqual([e.batch_no, e.batch_note], ['', ''], 'szyfrogram z pliku nie jest treścią');
  // konto A bez zmian
  assert.equal((await row(imported.id)).user_id, B);
  const again = await h.call(B, 'account/import', 'POST', { data });
  assert.equal(again.status, 200);
  assert.equal((await h.q`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${B}`)[0].n, data.purchases.length, 'idempotentnie');
});
