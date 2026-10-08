// KAT-1: propozycje zmian pól wspólnych odmiany zamiast wspólnej edycji. Nie-twórca nie zapisuje bezpośrednio,
// admin przyjmuje lub odrzuca, konflikt, limity, eksport, prywatność cudzych propozycji, usunięcie konta.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

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

const create = async (uid, f) => (await call(uid, 'strains', 'POST', { type: 'haze', producer: 'Aurora', ...f })).json.id;
const patch = (uid, id, f) => call(uid, 'strains/[id]', 'PATCH', { type: 'haze', producer: 'Aurora', ...f }, { id: String(id) });
const row = async (id) => (await q`SELECT name, thc::float8 AS thc, taste, description FROM strains WHERE id = ${id}`)[0];
const pending = async (uid) => (await call(uid, 'proposals', 'GET')).json.proposals;
const queue = async () => (await call(ids.Bocian, 'admin/proposals', 'GET')).json.proposals;
const decide = (uid, body) => call(uid, 'admin/proposals', 'POST', body);

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
  await q`UPDATE users SET must_change_password = FALSE WHERE is_admin`;
  for (const n of ['ania', 'bartek', 'celina']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});

after(async () => { if (pool) await pool.end(); });

test('twórca nieużywanej odmiany i admin edytują bezpośrednio', { skip }, async () => {
  const { ania: A, Bocian: ADM } = ids;
  const s = await create(A, { name: 'Własna', thc: 20 });
  const r = await patch(A, s, { name: 'Własna 2', thc: 21 });
  assert.equal(r.status, 200);
  assert.equal(r.json.proposal, undefined);
  assert.equal((await row(s)).name, 'Własna 2');
  assert.equal((await patch(ADM, s, { name: 'Admin', thc: 22 })).status, 200);
  assert.equal((await row(s)).name, 'Admin');
  assert.equal((await q`SELECT 1 FROM strain_proposals`).length, 0);
});

test('nie-twórca nie zapisuje bezpośrednio: powstaje propozycja z różnicą przed/po', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Cudza', thc: 20, taste: 'cytrus' });
  const r = await patch(B, s, { name: 'Cudza', thc: 25, taste: 'cytrus' });
  assert.equal(r.status, 202, JSON.stringify(r.json));
  assert.equal(r.json.proposal, true);
  assert.equal((await row(s)).thc, 20, 'odmiana bez zmian');
  assert.equal((await q`SELECT 1 FROM strain_edits WHERE strain_id = ${s}`).length, 0);
  const [p] = await q`SELECT user_id, status, changes FROM strain_proposals WHERE strain_id = ${s}`;
  assert.equal(p.user_id, B);
  assert.equal(p.status, 'oczekuje');
  assert.deepEqual(Object.keys(p.changes), ['thc']);
  assert.deepEqual(p.changes.thc, [20, 25]);
  // brak zmian = błąd, nie propozycja
  // bez zmian pól: 200 bez propozycji (formularz może wtedy wgrać samo zdjęcie)
  const same = await patch(B, s, { name: 'Cudza', thc: 20, taste: 'cytrus' });
  assert.equal(same.status, 200);
  assert.equal(same.json.unchanged, true);
  assert.equal(same.json.proposal, undefined);
  // ponowna propozycja tej samej osoby zastępuje poprzednią
  assert.equal((await patch(B, s, { name: 'Cudza', thc: 26, taste: 'cytrus' })).status, 202);
  const all = await q`SELECT changes FROM strain_proposals WHERE strain_id = ${s}`;
  assert.equal(all.length, 1);
  assert.deepEqual(all[0].changes.thc, [20, 26]);
});

test('twórca odmiany używanej przez inną osobę też składa propozycję', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Używana', thc: 18 });
  await call(B, 'strains/[id]/entry', 'PUT', { rating: 7 }, { id: String(s) });
  const r = await patch(A, s, { name: 'Używana', thc: 19 });
  assert.equal(r.status, 202, JSON.stringify(r.json));
  assert.equal((await row(s)).thc, 18);
});

test('odmiana bez twórcy (np. po usunięciu konta): zwykły użytkownik tylko proponuje', { skip }, async () => {
  const { celina: C } = ids;
  const s = (await q`INSERT INTO strains (producer, name, type, created_by) VALUES ('Aurora', 'Sierota', 'haze', NULL) RETURNING id`)[0].id;
  assert.equal((await patch(C, s, { name: 'Sierota', taste: 'x' })).status, 202);
  assert.equal((await row(s)).taste, '');
  assert.equal((await patch(C, 999999, { name: 'x' })).status, 404);
});

test('admin przyjmuje: zapis jak zwykła edycja, historia z autorem propozycji, status', { skip }, async () => {
  const { ania: A, bartek: B, Bocian: ADM } = ids;
  const s = await create(A, { name: 'Do przyjęcia', thc: 10, description: 'stary' });
  await patch(B, s, { name: 'Do przyjęcia', thc: 12, description: 'nowy' });
  const [item] = (await queue()).filter((x) => x.strainId === s);
  assert.equal(item.author, 'bartek');
  assert.deepEqual(item.diff.map((d) => [d.field, d.before, d.after, d.current, d.conflict]).sort(),
    [['description', 'stary', 'nowy', 'stary', false], ['thc', 10, 12, 10, false]]);
  const r = await decide(ADM, { id: item.id, action: 'accept' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const now = await row(s);
  assert.equal(now.thc, 12);
  assert.equal(now.description, 'nowy');
  const [e] = await q`SELECT user_id, changes FROM strain_edits WHERE strain_id = ${s}`;
  assert.equal(e.user_id, B, 'autorem zmiany jest autor propozycji');
  assert.deepEqual(e.changes.thc, [10, 12]);
  const [p] = await q`SELECT status, decided_by FROM strain_proposals WHERE id = ${item.id}`;
  assert.equal(p.status, 'przyjeta');
  assert.equal(p.decided_by, ADM);
  assert.equal((await queue()).some((x) => x.id === item.id), false);
  assert.equal((await pending(B)).find((x) => x.id === item.id).status, 'przyjeta');
  // drugie przyjęcie tej samej propozycji
  assert.equal((await decide(ADM, { id: item.id, action: 'accept' })).status, 409);
  assert.equal((await row(s)).thc, 12);
});

test('nowy producent z propozycji trafia do wspólnej listy dopiero po akceptacji', { skip }, async () => {
  const { ania: A, bartek: B, Bocian: ADM } = ids;
  const s = await create(A, { name: 'Nowy producent' });
  const has = async () => (await q`SELECT 1 FROM options WHERE kind = 'producer' AND value = 'Zupełnie Nowy Producent'`).length > 0;
  await patch(B, s, { name: 'Nowy producent', producer: 'Zupełnie Nowy Producent' });
  assert.equal(await has(), false, 'propozycja nie dopisuje opcji');
  const [item] = (await queue()).filter((x) => x.strainId === s);
  assert.equal((await decide(ADM, { id: item.id, action: 'accept' })).status, 200);
  assert.equal(await has(), true, 'akceptacja dopisuje opcję');
  assert.equal((await q`SELECT producer FROM strains WHERE id = ${s}`)[0].producer, 'Zupełnie Nowy Producent');
});

test('admin odrzuca z powodem; autor go widzi; odmiana bez zmian', { skip }, async () => {
  const { ania: A, bartek: B, Bocian: ADM } = ids;
  const s = await create(A, { name: 'Do odrzucenia', thc: 10 });
  await patch(B, s, { name: 'Do odrzucenia', thc: 30 });
  const [item] = (await queue()).filter((x) => x.strainId === s);
  assert.equal((await decide(ADM, { id: item.id, action: 'reject' })).status, 400, 'powód jest wymagany');
  assert.equal((await decide(ADM, { id: item.id, action: 'reject', reason: '  ' })).status, 400);
  const r = await decide(ADM, { id: item.id, action: 'reject', reason: 'Wartość niezgodna z kartą producenta' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal((await row(s)).thc, 10);
  const mine = (await pending(B)).find((x) => x.id === item.id);
  assert.equal(mine.status, 'odrzucona');
  assert.equal(mine.rejectReason, 'Wartość niezgodna z kartą producenta');
  assert.equal((await decide(ADM, { id: item.id, action: 'reject', reason: 'jeszcze raz' })).status, 409);
  // po odrzuceniu można złożyć nową propozycję
  assert.equal((await patch(B, s, { name: 'Do odrzucenia', thc: 11 })).status, 202);
});

test('nie-admin nie może przyjąć ani odrzucić ani zobaczyć kolejki', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Bez uprawnień', thc: 10 });
  await patch(B, s, { name: 'Bez uprawnień', thc: 14 });
  const [p] = await q`SELECT id FROM strain_proposals WHERE strain_id = ${s}`;
  for (const uid of [A, B]) {
    assert.equal((await decide(uid, { id: p.id, action: 'accept' })).status, 403);
    assert.equal((await decide(uid, { id: p.id, action: 'reject', reason: 'x' })).status, 403);
    assert.equal((await call(uid, 'admin/proposals', 'GET')).status, 403);
  }
  assert.equal((await call(null, 'admin/proposals', 'GET')).status, 401);
  assert.equal((await row(s)).thc, 10);
  assert.equal((await q`SELECT status FROM strain_proposals WHERE id = ${p.id}`)[0].status, 'oczekuje');
});

test('konflikt: pole zmienione od czasu propozycji blokuje przyjęcie, chyba że admin wymusi', { skip }, async () => {
  const { ania: A, bartek: B, Bocian: ADM } = ids;
  const s = await create(A, { name: 'Konflikt', thc: 10, taste: 'a' });
  await patch(B, s, { name: 'Konflikt', thc: 15, taste: 'b' });
  // twórca zmienia THC bezpośrednio (nikt inny jeszcze nie używa odmiany), smak zostaje
  assert.equal((await patch(A, s, { name: 'Konflikt', thc: 12, taste: 'a' })).status, 200);
  const [item] = (await queue()).filter((x) => x.strainId === s);
  const by = Object.fromEntries(item.diff.map((d) => [d.field, d]));
  assert.equal(by.thc.conflict, true);
  assert.equal(by.thc.current, 12);
  assert.equal(by.taste.conflict, false);
  const r = await decide(ADM, { id: item.id, action: 'accept' });
  assert.equal(r.status, 409);
  assert.match(r.json.error, /zmieniło się/);
  assert.equal((await row(s)).thc, 12, 'nic nie zapisano');
  assert.equal((await q`SELECT status FROM strain_proposals WHERE id = ${item.id}`)[0].status, 'oczekuje');
  const f = await decide(ADM, { id: item.id, action: 'accept', force: true });
  assert.equal(f.status, 200);
  assert.deepEqual([(await row(s)).thc, (await row(s)).taste], [15, 'b']);
});

test('limity: najwyżej 20 oczekujących na osobę, potem rate limit', { skip }, async () => {
  const { ania: A, celina: C } = ids;
  const list = [];
  for (let i = 0; i < 22; i++) list.push(await create(A, { name: `Limit ${i}`, thc: 10 }));
  const cap = 20;
  const before = (await q`SELECT count(*)::int AS n FROM strain_proposals WHERE user_id = ${C} AND status = 'oczekuje'`)[0].n;
  let ok = 0;
  for (let i = 0; i < 22 && before + ok < cap; i++) {
    const r = await patch(C, list[i], { name: `Limit ${i}`, thc: 11 });
    assert.equal(r.status, 202, JSON.stringify(r.json));
    ok++;
  }
  const over = await patch(C, list[21], { name: 'Limit 21', thc: 11 });
  assert.equal(over.status, 409);
  assert.match(over.json.error, /20/);
  // zastąpienie własnej oczekującej mieści się w limicie
  assert.equal((await patch(C, list[0], { name: 'Limit 0', thc: 12 })).status, 202);
  assert.equal((await q`SELECT count(*)::int AS n FROM strain_proposals WHERE user_id = ${C} AND status = 'oczekuje'`)[0].n, cap);
  // wycofanie zwalnia miejsce
  const mine = await pending(C);
  const w = await call(C, 'proposals/[id]', 'DELETE', null, { id: String(mine[0].id) });
  assert.equal(w.status, 200);
  assert.equal((await patch(C, list[21], { name: 'Limit 21', thc: 11 })).status, 202);
  // rate limit: 30 prób na godzinę
  let last;
  for (let i = 0; i < 12; i++) last = await patch(C, list[0], { name: 'Limit 0', thc: 13 + i });
  assert.equal(last.status, 429);
});

test('cudze propozycje niewidoczne; wycofać można tylko własną oczekującą', { skip }, async () => {
  const { ania: A, bartek: B, celina: C } = ids;
  const s = await create(A, { name: 'Prywatność', thc: 10 });
  await patch(B, s, { name: 'Prywatność', thc: 16 });
  const [p] = await q`SELECT id FROM strain_proposals WHERE strain_id = ${s}`;
  assert.equal((await pending(B)).some((x) => x.id === p.id), true);
  for (const uid of [A, C]) {
    assert.equal((await pending(uid)).some((x) => x.id === p.id), false);
    assert.equal((await call(uid, 'proposals/[id]', 'DELETE', null, { id: String(p.id) })).status, 404);
  }
  assert.equal((await call(null, 'proposals', 'GET')).status, 401);
  assert.equal((await call(B, 'proposals/[id]', 'DELETE', null, { id: String(p.id) })).status, 200);
  assert.equal((await q`SELECT 1 FROM strain_proposals WHERE id = ${p.id}`).length, 0);
});

test('eksport konta zawiera własne propozycje, a cudzych nie', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Eksport', thc: 10 });
  await patch(B, s, { name: 'Eksport', thc: 17 });
  const mine = (await call(B, 'account/export', 'GET')).json;
  const p = mine.strainProposals.find((x) => x.strain === 'Eksport');
  assert.equal(p.status, 'oczekuje');
  assert.deepEqual(p.changes.thc, [10, 17]);
  const theirs = (await call(A, 'account/export', 'GET')).json;
  assert.equal(theirs.strainProposals.some((x) => x.strain === 'Eksport'), false);
});

test('kopia zapasowa obejmuje tabelę propozycji', { skip }, async () => {
  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.ok(Array.isArray(b.strain_proposals) && b.strain_proposals.length > 0);
});

test('usunięcie konta usuwa propozycje autora, historia zmian zostaje', { skip }, async () => {
  const { ania: A, Bocian: ADM } = ids;
  const reg = await call(null, 'auth/register', 'POST', { username: 'dorota', password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
  assert.equal(reg.status, 200);
  const D = (await q`SELECT id FROM users WHERE username = 'dorota'`)[0].id;
  const s1 = await create(A, { name: 'Konto 1', thc: 10 });
  const s2 = await create(A, { name: 'Konto 2', thc: 10 });
  await patch(D, s1, { name: 'Konto 1', thc: 11 });
  await patch(D, s2, { name: 'Konto 2', thc: 11 });
  const [p2] = await q`SELECT id FROM strain_proposals WHERE strain_id = ${s2}`;
  assert.equal((await decide(ADM, { id: p2.id, action: 'accept' })).status, 200);
  const del = await call(D, 'account', 'DELETE', { password: 'haslo1234' });
  assert.equal(del.status, 200, JSON.stringify(del.json));
  assert.equal((await q`SELECT 1 FROM strain_proposals WHERE user_id = ${D}`).length, 0);
  assert.equal((await q`SELECT 1 FROM strain_edits WHERE strain_id = ${s2}`).length, 1, 'zaakceptowana zmiana zostaje w historii odmiany');
  assert.equal((await row(s2)).thc, 11);
});
