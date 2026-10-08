// Limity tworzenia treści wspólnych (odmiany, opcje, testy, zaproszenia, recepty) i zgłoszenia odmian / zdjęć odmian.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { setup, skip } from './harness.mjs';

let h;
before(async () => { if (!skip) h = await setup(['ania', 'bartek', 'celina', 'darek']); });
after(async () => { if (h) await h.pool.end(); });

const reset = () => h.q`DELETE FROM rate_limits`;
const strainBody = (n) => ({ name: `Odmiana ${n}`, producer: 'Prod', type: 'haze' });

test('POST /api/strains: 20 nowych odmian na godzinę, potem 429 po polsku (inne konto nie jest dotknięte)', { skip }, async () => {
  await reset();
  for (let i = 0; i < 20; i++) assert.equal((await h.call(h.ids.ania, 'strains', 'POST', strainBody(i))).status, 200);
  const r = await h.call(h.ids.ania, 'strains', 'POST', strainBody(99));
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Zbyt wiele nowych odmian/);
  assert.equal((await h.call(h.ids.bartek, 'strains', 'POST', strainBody(1))).status, 200);
});

test('POST /api/options: 30 na godzinę, potem 429', { skip }, async () => {
  await reset();
  for (let i = 0; i < 30; i++) assert.equal((await h.call(h.ids.ania, 'options', 'POST', { kind: 'producer', value: `Prod ${i}` })).status, 200);
  const r = await h.call(h.ids.ania, 'options', 'POST', { kind: 'producer', value: 'Jeszcze jeden' });
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Zbyt wiele nowych opcji/);
});

test('POST /api/strains/[id]/tests: limit godzinowy i najwyżej 50 testów jednego konta przy odmianie', { skip }, async () => {
  const { q, ids, call } = h;
  await reset();
  const [s] = await q`INSERT INTO strains (name, producer, type, created_by) VALUES ('T', 'P', 'haze', ${ids.bartek}) RETURNING id`;
  const [s2] = await q`INSERT INTO strains (name, producer, type, created_by) VALUES ('T2', 'P', 'haze', ${ids.bartek}) RETURNING id`;
  // 49 testów już jest (wstawione wprost), 50. przechodzi, 51. nie
  for (let i = 0; i < 49; i++) await q`INSERT INTO strain_tests (strain_id, user_id, note) VALUES (${s.id}, ${ids.celina}, ${`n${i}`})`;
  assert.equal((await call(ids.celina, 'strains/[id]/tests', 'POST', { note: 'pięćdziesiąty' }, { id: String(s.id) })).status, 200);
  const r = await call(ids.celina, 'strains/[id]/tests', 'POST', { note: 'ponad limit' }, { id: String(s.id) });
  assert.equal(r.status, 429);
  assert.match(r.json.error, /najwyżej 50 testów/);
  // limit dotyczy pary konto + odmiana
  assert.equal((await call(ids.celina, 'strains/[id]/tests', 'POST', { note: 'inna odmiana' }, { id: String(s2.id) })).status, 200);
  assert.equal((await call(ids.darek, 'strains/[id]/tests', 'POST', { note: 'inne konto' }, { id: String(s.id) })).status, 200);
  // limit godzinowy (30): kolejne konto wysyła testy do osobnych odmian
  await reset();
  let last;
  for (let i = 0; i < 31; i++) last = await call(ids.darek, 'strains/[id]/tests', 'POST', { note: `x${i}` }, { id: String(s2.id) });
  assert.equal(last.status, 429);
  assert.match(last.json.error, /Zbyt wiele nowych testów/);
});

test('POST /api/friends (request): 30 zaproszeń na godzinę; accept i remove nie zużywają limitu', { skip }, async () => {
  const { q, ids, call } = h;
  await reset();
  const extra = [];
  for (let i = 0; i < 31; i++) extra.push((await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${`gosc${i}`}, 'x', false) RETURNING id`)[0].id);
  for (let i = 0; i < 30; i++) assert.equal((await call(ids.ania, 'friends', 'POST', { action: 'request', userId: extra[i] })).status, 200);
  const r = await call(ids.ania, 'friends', 'POST', { action: 'request', userId: extra[30] });
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Zbyt wiele zaproszeń/);
  assert.equal((await call(ids.ania, 'friends', 'POST', { action: 'remove', userId: extra[0] })).status, 200);
});

test('POST /api/prescriptions: 30 na godzinę, potem 429', { skip }, async () => {
  await reset();
  const b = { issuedOn: '2026-09-01', grams: 10 };
  for (let i = 0; i < 30; i++) assert.equal((await h.call(h.ids.ania, 'prescriptions', 'POST', b)).status, 200);
  const r = await h.call(h.ids.ania, 'prescriptions', 'POST', b);
  assert.equal(r.status, 429);
  assert.match(r.json.error, /Zbyt wiele nowych recept/);
});

test('zgłoszenia: odmiana i zdjęcie odmiany trafiają do admina z autorem i nazwą', { skip }, async () => {
  const { q, ids, call } = h;
  await reset();
  await q`UPDATE users SET is_admin = TRUE WHERE id = ${ids.darek}`;
  const [s] = await q`INSERT INTO strains (name, producer, type, created_by) VALUES ('Zgłaszana', 'P', 'haze', ${ids.bartek}) RETURNING id`;
  const [cat] = await q`INSERT INTO strains (name, producer, type, created_by) VALUES ('Katalogowa', 'P', 'haze', NULL) RETURNING id`;
  // odmiana
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'strain', ref: s.id, reason: 'spam' })).status, 200);
  // userId z żądania jest ignorowany (nie można zgłosić cudzego konta pod pozorem odmiany)
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'strain', ref: s.id, userId: ids.celina, reason: 'ad' })).status, 200);
  // duplikat nie tworzy drugiego wiersza
  assert.equal((await q`SELECT count(*)::int AS n FROM reports WHERE type = 'strain'`)[0].n, 1);
  // zdjęcie: brak zdjęcia = 404
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'photo', ref: s.id, reason: 'abuse' })).status, 404);
  await q`INSERT INTO strain_photos (strain_id, mime, data, uploaded_by) VALUES (${s.id}, 'image/png', 'x', ${ids.celina})`;
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'photo', ref: s.id, reason: 'abuse', note: 'nieodpowiednie' })).status, 200);
  const [ph] = await q`SELECT target_user_id FROM reports WHERE type = 'photo'`;
  assert.equal(ph.target_user_id, ids.celina); // odpowiada osoba, która dodała zdjęcie
  // własna treść, nieistniejąca odmiana, odmiana katalogowa bez autora, zły typ
  assert.equal((await call(ids.bartek, 'reports', 'POST', { type: 'strain', ref: s.id, reason: 'spam' })).status, 400);
  assert.equal((await call(ids.celina, 'reports', 'POST', { type: 'photo', ref: s.id, reason: 'spam' })).status, 400);
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'strain', ref: 999999, reason: 'spam' })).status, 404);
  const c = await call(ids.ania, 'reports', 'POST', { type: 'strain', ref: cat.id, reason: 'spam' });
  assert.equal(c.status, 422);
  assert.match(c.json.error, /katalogu/);
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'option', ref: 1, reason: 'spam' })).status, 400);
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'strain', reason: 'spam' })).status, 400);
  // panel admina
  const list = await call(ids.darek, 'admin/reports', 'GET');
  assert.equal(list.status, 200);
  const types = list.json.reports.map((r) => r.type).sort();
  assert.deepEqual(types, ['photo', 'strain']);
  const rs = list.json.reports.find((r) => r.type === 'strain');
  assert.equal(rs.strain_name, 'P Zgłaszana');
  assert.equal(rs.target, 'bartek');
  const rp = list.json.reports.find((r) => r.type === 'photo');
  assert.equal(rp.photo_exists, true);
  // zwykły użytkownik nie widzi listy
  assert.equal((await call(ids.ania, 'admin/reports', 'GET')).status, 403);
  // „usuń zdjęcie i zamknij” kasuje wspólne zdjęcie, ale nie samą odmianę
  const done = await call(ids.darek, 'admin/reports', 'POST', { id: rp.id, deleteContent: true });
  assert.equal(done.status, 200);
  assert.equal((await q`SELECT count(*)::int AS n FROM strain_photos WHERE strain_id = ${s.id}`)[0].n, 0);
  assert.equal((await q`SELECT count(*)::int AS n FROM strains WHERE id = ${s.id}`)[0].n, 1);
  // zamknięcie zgłoszenia odmiany nie usuwa odmiany nawet z deleteContent
  await call(ids.darek, 'admin/reports', 'POST', { id: rs.id, deleteContent: true });
  assert.equal((await q`SELECT count(*)::int AS n FROM strains WHERE id = ${s.id}`)[0].n, 1);
});

test('zgłoszenia użytkownika i testu działają jak dotąd', { skip }, async () => {
  const { q, ids, call } = h;
  await reset();
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'user', userId: ids.bartek, reason: 'spam' })).status, 200);
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'user', userId: ids.ania, reason: 'spam' })).status, 400);
  const [s] = await q`INSERT INTO strains (name, producer, type, created_by) VALUES ('X', 'P', 'haze', ${ids.bartek}) RETURNING id`;
  const [t] = await q`INSERT INTO strain_tests (strain_id, user_id, note, visibility) VALUES (${s.id}, ${ids.bartek}, 'prywatny', 'me') RETURNING id`;
  assert.equal((await call(ids.ania, 'reports', 'POST', { type: 'test', userId: ids.bartek, ref: t.id, reason: 'spam' })).status, 404);
});
