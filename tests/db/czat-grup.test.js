// SPO-2: czat grupowy (app/api/groups/[id]/messages, read, zgłoszenia, eksport, kopia, licznik nieprzeczytanych).
// Test sam ustawia DATA_ENCRYPTION_KEY tam, gdzie to ważne (i przywraca wartość z otoczenia).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { setup, skip } from './harness.mjs';

const KEY = `c1:${randomBytes(32).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
const setKey = (v) => { if (v == null) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = v; };

let h, G, G2;
const MSG = 'groups/[id]/messages', ONE = 'groups/[id]/messages/[mid]', READ = 'groups/[id]/read';
const p = (id, mid) => ({ id: String(id), ...(mid && { mid: String(mid) }) });

before(async () => {
  if (skip) return;
  setKey(KEY);
  h = await setup(['ania', 'bartek', 'celina', 'darek', 'adm']);
  const { q, ids } = h;
  await q`UPDATE users SET is_admin = true WHERE id = ${ids.adm}`;
  await q`UPDATE users SET password_hash = ${await bcrypt.hash('haslo-usera-1', 4)}`;
  // grupa G: ania (właściciel), bartek (członek), celina (zaproszona, bez przyjęcia); darek jest obcy
  [{ id: G }] = await q`INSERT INTO groups (name, owner_id) VALUES ('Grupa testowa', ${ids.ania}) RETURNING id`;
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES
    (${G}, ${ids.ania}, 'owner', 'active'), (${G}, ${ids.bartek}, 'member', 'active'), (${G}, ${ids.celina}, 'member', 'invited')`;
  [{ id: G2 }] = await q`INSERT INTO groups (name, owner_id) VALUES ('Druga grupa', ${ids.darek}) RETURNING id`;
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G2}, ${ids.darek}, 'owner', 'active')`;
});
after(async () => { setKey(savedKey); if (h) await h.pool.end(); });

const clean = () => h.q`DELETE FROM rate_limits`;
const send = async (uid, body, gid = G) => (await h.call(uid, MSG, 'POST', { body }, p(gid)));
const list = (uid, query = '', gid = G) => h.call(uid, MSG, 'GET', undefined, p(gid), query);

test('członek pisze i czyta; autor, mine i canDelete zgodne z rolą', { skip }, async () => {
  const { ids } = h;
  await clean();
  const a = await send(ids.ania, '  Cześć wszystkim  ');
  assert.equal(a.status, 200, JSON.stringify(a.json));
  assert.equal(a.json.message.body, 'Cześć wszystkim', 'treść po trim');
  assert.equal(a.json.message.mine, true);
  const b = await send(ids.bartek, 'Hej <b>ania</b> https://example.com');
  assert.equal(b.status, 200);
  // bartek widzi obie, w kolejności rosnącej; cudza wiadomość: nie moja, nie do usunięcia dla zwykłego członka
  const r = await list(ids.bartek);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.messages.map((m) => m.body), ['Cześć wszystkim', 'Hej <b>ania</b> https://example.com'], 'treść bez zmian, jako tekst');
  assert.deepEqual(r.json.messages.map((m) => [m.name, m.mine, m.canDelete]), [['ania', false, false], ['bartek', true, true]]);
  assert.equal(r.json.hasMore, false);
  // właściciel może usunąć cudzą
  assert.deepEqual((await list(ids.ania)).json.messages.map((m) => m.canDelete), [true, true]);
  // nazwa wyświetlana zamiast loginu
  await h.q`UPDATE users SET display_name = 'Ania K.' WHERE id = ${ids.ania}`;
  assert.equal((await list(ids.bartek)).json.messages[0].name, 'Ania K.');
});

test('obcy i zaproszony bez przyjęcia dostają 404 na każdej trasie czatu, bez ujawnienia treści', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  const [m] = await q`SELECT id FROM group_messages WHERE group_id = ${G} ORDER BY id LIMIT 1`;
  for (const uid of [ids.darek, ids.celina]) {
    for (const [route, method, body, params] of [
      [MSG, 'GET', undefined, p(G)], [MSG, 'POST', { body: 'wchodzę' }, p(G)],
      [ONE, 'PATCH', { body: 'x' }, p(G, m.id)], [ONE, 'DELETE', undefined, p(G, m.id)], [READ, 'POST', {}, p(G)],
    ]) {
      const r = await h.call(uid, route, method, body, params);
      assert.equal(r.status, 404, `${route} ${method} dla ${uid}`);
      assert.doesNotMatch(JSON.stringify(r.json), /Cześć|ania/);
    }
  }
  // wiadomość z cudzej grupy nie jest dostępna przez adres własnej
  assert.equal((await h.call(ids.darek, ONE, 'DELETE', undefined, p(G2, m.id))).status, 404);
  assert.equal((await send(ids.darek, 'u siebie', G2)).status, 200);
  assert.equal((await h.call(ids.ania, MSG, 'GET', undefined, p('abc'))).status, 404, 'zły identyfikator');
  // po przyjęciu zaproszenia celina ma dostęp
  assert.equal((await h.call(ids.celina, 'groups/[id]', 'POST', { action: 'accept' }, p(G))).status, 200);
  assert.equal((await list(ids.celina)).status, 200);
  await q`UPDATE group_members SET status = 'invited' WHERE group_id = ${G} AND user_id = ${ids.celina}`;
  assert.equal((await list(ids.celina)).status, 404, 'po cofnięciu zaproszenia znów 404');
});

test('usunięty z grupy i opuszczający grupę tracą dostęp od razu', { skip }, async () => {
  const { ids } = h;
  await clean();
  await h.q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.darek}, 'member', 'active')`;
  assert.equal((await send(ids.darek, 'jestem')).status, 200);
  assert.equal((await h.call(ids.ania, 'groups/[id]', 'POST', { action: 'kick', userId: ids.darek }, p(G))).status, 200);
  assert.equal((await list(ids.darek)).status, 404);
  assert.equal((await send(ids.darek, 'wracam')).status, 404);
  // opuszczenie
  await h.q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.darek}, 'member', 'active')`;
  assert.equal((await list(ids.darek)).status, 200);
  assert.equal((await h.call(ids.darek, 'groups/[id]', 'POST', { action: 'leave' }, p(G))).status, 200);
  assert.equal((await list(ids.darek)).status, 404);
  assert.equal((await send(ids.darek, 'wracam')).status, 404);
});

test('walidacja treści: 1..2000 znaków po trim', { skip }, async () => {
  const { ids } = h;
  await clean();
  for (const bad of ['', '   \n ', 'x'.repeat(2001), undefined]) {
    assert.equal((await send(ids.ania, bad)).status, 400, JSON.stringify(bad)?.slice(0, 20));
  }
  assert.equal((await send(ids.ania, 'x'.repeat(2000))).status, 200);
  assert.equal((await send(ids.ania, `  ${'y'.repeat(2000)}  `)).status, 200, 'spacje poza limitem znaków');
  const r = await h.call(ids.ania, MSG, 'POST', '{zepsute', p(G));
  assert.equal(r.status, 400);
});

test('edycja własnej wiadomości do 15 minut; cudzej i po terminie nie', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  const id = (await send(ids.bartek, 'literówka')).json.message.id;
  const ok = await h.call(ids.bartek, ONE, 'PATCH', { body: ' poprawione ' }, p(G, id));
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(ok.json.message.body, 'poprawione');
  assert.ok(ok.json.message.editedAt);
  assert.equal((await h.call(ids.ania, ONE, 'PATCH', { body: 'cudza' }, p(G, id))).status, 404, 'cudza');
  assert.equal((await h.call(ids.bartek, ONE, 'PATCH', { body: '' }, p(G, id))).status, 400);
  await q`UPDATE group_messages SET created_at = now() - interval '16 minutes' WHERE id = ${id}`;
  const late = await h.call(ids.bartek, ONE, 'PATCH', { body: 'za późno' }, p(G, id));
  assert.equal(late.status, 403);
  assert.equal((await list(ids.bartek)).json.messages.find((m) => m.id === id).canEdit, false);
  assert.equal((await list(ids.bartek)).json.messages.find((m) => m.id === id).body, 'poprawione');
  await q`UPDATE group_messages SET created_at = now() - interval '14 minutes' WHERE id = ${id}`;
  assert.equal((await h.call(ids.bartek, ONE, 'PATCH', { body: 'jeszcze można' }, p(G, id))).status, 200);
});

test('usuwanie: autor, właściciel grupy i admin aplikacji tak; inny członek nie; treść znika z bazy', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.celina}, 'member', 'active') ON CONFLICT (group_id, user_id) DO UPDATE SET status = 'active'`;
  const mk = async (uid, t) => (await send(uid, t)).json.message.id;
  const own = await mk(ids.bartek, 'moja do usunięcia');
  const byOwner = await mk(ids.bartek, 'usunie właściciel');
  const byAdmin = await mk(ids.bartek, 'usunie admin');
  const safe = await mk(ids.bartek, 'cudza, nie ruszać');
  assert.equal((await h.call(ids.celina, ONE, 'DELETE', undefined, p(G, safe))).status, 403, 'inny członek');
  assert.equal((await h.call(ids.bartek, ONE, 'DELETE', undefined, p(G, own))).status, 200, 'autor');
  assert.equal((await h.call(ids.ania, ONE, 'DELETE', undefined, p(G, byOwner))).status, 200, 'właściciel');
  assert.equal((await h.call(ids.adm, ONE, 'DELETE', undefined, p(G, byAdmin))).status, 200, 'admin spoza grupy');
  assert.equal((await h.call(ids.bartek, ONE, 'DELETE', undefined, p(G, own))).status, 404, 'powtórne usunięcie');
  const rows = await q`SELECT id, body, deleted_at, deleted_by FROM group_messages WHERE id IN (${own}, ${byOwner}, ${byAdmin}, ${safe}) ORDER BY id`;
  assert.deepEqual(rows.map((r) => [r.body === '', !!r.deleted_at, r.deleted_by]), [[true, true, ids.bartek], [true, true, ids.ania], [true, true, ids.adm], [false, false, null]]);
  const seen = (await list(ids.celina)).json.messages.filter((m) => [own, byOwner, byAdmin, safe].includes(m.id));
  assert.deepEqual(seen.map((m) => [m.deleted, m.body, m.canDelete]), [[true, '', false], [true, '', false], [true, '', false], [false, 'cudza, nie ruszać', false]]);
  assert.equal((await h.call(ids.bartek, ONE, 'PATCH', { body: 'po usunięciu' }, p(G, own))).status, 404, 'usuniętej nie edytujemy');
  // admin spoza grupy nie czyta ani nie pisze
  assert.equal((await list(ids.adm)).status, 404);
  assert.equal((await send(ids.adm, 'x')).status, 404);
});

test('limity: 20 wiadomości na minutę i 300 na godzinę na użytkownika', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  for (let i = 0; i < 20; i++) assert.equal((await send(ids.bartek, `l${i}`)).status, 200, `wiadomość ${i}`);
  const r = await send(ids.bartek, 'za dużo');
  assert.equal(r.status, 429);
  assert.equal((await send(ids.ania, 'inny użytkownik ma swój limit')).status, 200);
  // godzinowy
  await clean();
  await q`INSERT INTO rate_limits (key, n, reset_at) VALUES (${`chat:${ids.bartek}:h`}, 300, now() + interval '30 minutes')`;
  assert.equal((await send(ids.bartek, 'godzina')).status, 429);
  await clean();
  await q`INSERT INTO rate_limits (key, n, reset_at) VALUES (${`chat-edit:${ids.bartek}`}, 30, now() + interval '30 seconds')`;
  const id = (await send(ids.bartek, 'edytowana')).json.message.id;
  assert.equal((await h.call(ids.bartek, ONE, 'PATCH', { body: 'zmiana' }, p(G, id))).status, 429);
  await clean();
});

test('stronicowanie: najnowsza strona 30, before = starsze, after = nowsze (do 50)', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`DELETE FROM group_messages WHERE group_id = ${G}`;
  for (let i = 1; i <= 75; i++) await q`INSERT INTO group_messages (group_id, user_id, body) VALUES (${G}, ${ids.ania}, ${`m${i}`})`;
  const all = (await q`SELECT id FROM group_messages WHERE group_id = ${G} ORDER BY id`).map((r) => r.id);
  const newest = (await list(ids.bartek)).json;
  assert.equal(newest.messages.length, 30);
  assert.equal(newest.hasMore, true);
  assert.deepEqual(newest.messages.map((m) => m.id), all.slice(45));
  const mid = (await list(ids.bartek, `?before=${all[45]}`)).json;
  assert.deepEqual(mid.messages.map((m) => m.id), all.slice(15, 45));
  assert.equal(mid.hasMore, true);
  const first = (await list(ids.bartek, `?before=${all[15]}`)).json;
  assert.equal(first.messages.length, 15);
  assert.equal(first.hasMore, false);
  // after: rosnąco, najwyżej 50
  const aft = (await list(ids.bartek, `?after=${all[4]}`)).json;
  assert.equal(aft.messages.length, 50);
  assert.deepEqual(aft.messages.map((m) => m.id), all.slice(5, 55));
  assert.equal((await list(ids.bartek, `?after=${all[74]}`)).json.messages.length, 0);
  // złe parametry nie wywalają trasy
  assert.equal((await list(ids.bartek, '?before=abc&after=-1')).status, 200);
  // wiadomość z innej grupy nie miesza się do listy
  await send(ids.darek, 'cudza grupa', G2);
  assert.equal((await list(ids.bartek, `?after=${all[74]}`)).json.messages.length, 0);
});

test('blokada w dowolną stronę ukrywa wiadomości drugiej osoby', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`DELETE FROM group_messages WHERE group_id = ${G}`;
  await send(ids.ania, 'od ani');
  await send(ids.bartek, 'od bartka');
  await q`INSERT INTO blocks (blocker, blocked) VALUES (${ids.bartek}, ${ids.ania})`;
  assert.deepEqual((await list(ids.bartek)).json.messages.map((m) => m.body), ['od bartka']);
  assert.deepEqual((await list(ids.ania)).json.messages.map((m) => m.body), ['od ani']);
  await q`DELETE FROM blocks`;
});

test('szyfrowanie: w bazie szyfrogram z AAD z id, odczyt jawny; zły klucz: 422 przy zapisie, znacznik przy odczycie', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  const sent = await send(ids.ania, 'tajna wiadomość');
  const id = sent.json.message.id;
  const [row] = await q`SELECT body FROM group_messages WHERE id = ${id}`;
  assert.match(row.body, /^zenc1:c1:/);
  assert.ok(!row.body.includes('tajna'));
  assert.equal((await list(ids.bartek)).json.messages.at(-1).body, 'tajna wiadomość');
  const dc = await import('../../lib/data-crypto.js');
  assert.equal(dc.decryptStrict('group_messages', 'body', String(id), row.body), 'tajna wiadomość');
  assert.throws(() => dc.decryptStrict('group_messages', 'body', String(id + 1), row.body), 'AAD wiążące z id wiersza');
  // szyfrogram przeniesiony do innego wiersza jest nieczytelny (znacznik zamiast treści), nie wyjątek
  const other = (await send(ids.bartek, 'inna')).json.message.id;
  await q`UPDATE group_messages SET body = ${row.body} WHERE id = ${other}`;
  const moved = (await list(ids.ania)).json.messages.find((m) => m.id === other);
  assert.deepEqual([moved.locked, moved.body], [true, '']);
  // edycja zapisuje nowy szyfrogram
  assert.equal((await h.call(ids.ania, ONE, 'PATCH', { body: 'poprawiona tajna' }, p(G, id))).status, 200);
  const [after] = await q`SELECT body FROM group_messages WHERE id = ${id}`;
  assert.match(after.body, /^zenc1:/);
  assert.notEqual(after.body, row.body);
  // zły format klucza: zapis i edycja 422, nic nie trafia do bazy jawnie; odczyt nieczytelny
  const n = (await q`SELECT count(*)::int AS n FROM group_messages`)[0].n;
  setKey('to-nie-jest-klucz');
  try {
    assert.equal((await send(ids.ania, 'nie zapisze się')).status, 422);
    assert.equal((await h.call(ids.ania, ONE, 'PATCH', { body: 'też nie' }, p(G, id))).status, 422);
    assert.equal((await q`SELECT count(*)::int AS n FROM group_messages`)[0].n, n);
    assert.deepEqual((await list(ids.ania)).json.messages.find((m) => m.id === id).locked, true);
  } finally { setKey(KEY); }
  // bez klucza: zapis jawny (z ochroną prefiksu), odczyt działa, a stary szyfrogram jest nieczytelny
  setKey(null);
  try {
    const plain = await send(ids.ania, 'zenc1:udaję szyfrogram');
    assert.equal(plain.status, 200);
    assert.equal(plain.json.message.body, 'zenc1:udaję szyfrogram');
    assert.match((await q`SELECT body FROM group_messages WHERE id = ${plain.json.message.id}`)[0].body, /^zplain:zenc1:/);
    assert.equal((await list(ids.ania)).json.messages.find((m) => m.id === id).locked, true);
  } finally { setKey(KEY); }
  assert.equal((await list(ids.ania)).json.messages.find((m) => m.id === id).body, 'poprawiona tajna', 'z kluczem znów czytelna');
});

test('zgłoszenie wiadomości: tylko członek grupy, cudzej, nieusuniętej; admin widzi treść i może ją usunąć', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`DELETE FROM reports`;
  const id = (await send(ids.bartek, 'wiadomość do zgłoszenia')).json.message.id;
  const rep = (uid, ref, extra = {}) => h.call(uid, 'reports', 'POST', { type: 'message', ref, reason: 'ad', note: 'sprzedaż', ...extra });
  assert.equal((await rep(ids.darek, id)).status, 404, 'obcy');
  assert.equal((await rep(ids.bartek, id)).status, 400, 'własna');
  assert.equal((await rep(ids.ania, 99999)).status, 404);
  assert.equal((await rep(ids.ania, id)).status, 200);
  assert.equal((await rep(ids.ania, id)).status, 200, 'duplikat bez błędu');
  const stored = await q`SELECT type, ref, target_user_id, reporter_id FROM reports`;
  assert.deepEqual(stored.map((r) => [r.type, r.ref, r.target_user_id, r.reporter_id]), [['message', id, ids.bartek, ids.ania]]);
  // nie-admin nie ma dostępu do panelu
  assert.equal((await h.call(ids.ania, 'admin/reports', 'GET')).status, 403);
  const adm = await h.call(ids.adm, 'admin/reports', 'GET');
  assert.equal(adm.status, 200);
  const r = adm.json.reports[0];
  assert.deepEqual([r.type, r.message_body, r.message_group, r.message_exists], ['message', 'wiadomość do zgłoszenia', 'Grupa testowa', true]);
  const done = await h.call(ids.adm, 'admin/reports', 'POST', { id: r.id, deleteContent: true });
  assert.equal(done.status, 200);
  assert.deepEqual(done.json.reports, []);
  const [m] = await q`SELECT body, deleted_at, deleted_by FROM group_messages WHERE id = ${id}`;
  assert.deepEqual([m.body, !!m.deleted_at, m.deleted_by], ['', true, ids.adm]);
  assert.equal((await rep(ids.ania, id)).status, 404, 'usuniętej nie zgłaszamy');
  // zgłoszenie wiadomości sprzed wyrzucenia z grupy: zgłaszający spoza grupy dostaje 404
  const id2 = (await send(ids.bartek, 'druga')).json.message.id;
  await q`UPDATE group_members SET status = 'invited' WHERE group_id = ${G} AND user_id = ${ids.ania}`;
  assert.equal((await rep(ids.ania, id2)).status, 404);
  await q`UPDATE group_members SET status = 'active' WHERE group_id = ${G} AND user_id = ${ids.ania}`;
});

test('eksport zawiera tylko własne, nieusunięte wiadomości (odszyfrowane); kopia zawiera szyfrogram', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`DELETE FROM group_messages`;
  await send(ids.ania, 'moja pierwsza');
  const gone = (await send(ids.ania, 'moja usunięta')).json.message.id;
  await send(ids.bartek, 'cudza wiadomość');
  await h.call(ids.ania, ONE, 'DELETE', undefined, p(G, gone));
  const ex = await h.call(ids.ania, 'account/export', 'GET');
  assert.equal(ex.status, 200);
  assert.deepEqual(ex.json.groupMessages.map((m) => [m.group, m.body]), [['Grupa testowa', 'moja pierwsza']]);
  assert.ok(ex.json.groupMessages[0].createdAt);
  assert.doesNotMatch(JSON.stringify(ex.json), /cudza wiadomość/);
  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.equal(b.group_messages.length, 3);
  assert.ok(b.group_messages.filter((m) => m.body).every((m) => m.body.startsWith('zenc1:')), 'szyfrogram zostaje szyfrogramem');
  assert.doesNotMatch(JSON.stringify(b.group_messages), /moja pierwsza|cudza/);
});

test('licznik nieprzeczytanych: lista grup, powiadomienia, /read; własne i usunięte się nie liczą', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`DELETE FROM group_messages`;
  await q`UPDATE group_members SET last_read_message_id = 0`;
  const unread = async (uid) => ({
    n: (await h.call(uid, 'notifications', 'GET')).json,
    g: (await h.call(uid, 'groups', 'GET')).json.groups.find((x) => x.id === G)?.unread,
  });
  await send(ids.ania, 'a1');
  await send(ids.ania, 'a2');
  const del = (await send(ids.ania, 'a3')).json.message.id;
  await send(ids.bartek, 'b1');
  await h.call(ids.ania, ONE, 'DELETE', undefined, p(G, del));
  const b = await unread(ids.bartek);
  assert.equal(b.g, 2, 'dwie cudze nieusunięte');
  assert.equal(b.n.chat, 2);
  assert.equal(b.n.groups, 2, 'plakietka Grupy = zaproszenia + nieprzeczytane');
  const a = await unread(ids.ania);
  assert.equal(a.g, 1, 'tylko wiadomość bartka');
  // obcy nie ma licznika z cudzej grupy
  assert.equal((await unread(ids.darek)).n.chat, 0);
  // przeczytanie: do wskazanego id, znacznik tylko rośnie
  const msgs = (await list(ids.bartek)).json.messages;
  const firstOther = msgs.find((m) => m.body === 'a1').id;
  assert.equal((await h.call(ids.bartek, READ, 'POST', { upTo: firstOther }, p(G))).status, 200);
  assert.equal((await unread(ids.bartek)).g, 1);
  assert.equal((await h.call(ids.bartek, READ, 'POST', { upTo: 1 }, p(G))).status, 200);
  assert.equal((await unread(ids.bartek)).g, 1, 'cofnięcie nic nie zmienia');
  assert.equal((await h.call(ids.bartek, READ, 'POST', { upTo: 2147483647 }, p(G))).status, 200);
  const [lr] = await q`SELECT last_read_message_id AS n FROM group_members WHERE group_id = ${G} AND user_id = ${ids.bartek}`;
  assert.equal(lr.n, Math.max(...(await q`SELECT id FROM group_messages`).map((r) => r.id)), 'nie wyżej niż najnowsza wiadomość');
  assert.equal((await unread(ids.bartek)).g, 0);
  assert.equal((await h.call(ids.bartek, READ, 'POST', undefined, p(G))).status, 200, 'bez treści = wszystko');
  // nowy członek: historia sprzed przyjęcia zaproszenia nie jest nieprzeczytana
  await q`UPDATE group_members SET status = 'invited', last_read_message_id = 0 WHERE group_id = ${G} AND user_id = ${ids.celina}`;
  assert.equal((await unread(ids.celina)).g, 0, 'zaproszony nie ma licznika');
  assert.equal((await h.call(ids.celina, 'groups/[id]', 'POST', { action: 'accept' }, p(G))).status, 200);
  assert.equal((await unread(ids.celina)).g, 0);
  await send(ids.bartek, 'b2');
  assert.equal((await unread(ids.celina)).g, 1);
});

test('usunięcie konta usuwa jego wiadomości (grupa i cudze zostają)', { skip }, async () => {
  const { ids, q } = h;
  await clean();
  await q`DELETE FROM group_messages`;
  await q`DELETE FROM reports`;
  await send(ids.celina, 'celiny 1');
  await send(ids.celina, 'celiny 2');
  const keep = (await send(ids.bartek, 'bartka')).json.message.id;
  await h.call(ids.ania, 'reports', 'POST', { type: 'message', ref: keep, reason: 'spam' });
  const r = await h.call(ids.celina, 'account', 'DELETE', { password: 'haslo-usera-1' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual((await q`SELECT user_id FROM group_messages`).map((x) => x.user_id), [ids.bartek]);
  assert.equal((await q`SELECT count(*)::int AS n FROM groups WHERE id = ${G}`)[0].n, 1);
  assert.equal((await list(ids.ania)).json.messages.at(-1).id, keep);
  // usunięcie autora zgłoszonej wiadomości usuwa też zgłoszenie (target_user_id kaskadowo)
  await h.call(ids.bartek, 'account', 'DELETE', { password: 'haslo-usera-1' });
  assert.equal((await q`SELECT count(*)::int AS n FROM group_messages`)[0].n, 0);
  assert.equal((await q`SELECT count(*)::int AS n FROM reports`)[0].n, 0);
});

test('ensureDb jest idempotentne dla czatu (drugie uruchomienie bez błędów)', { skip }, async () => {
  const { ensureDb } = await import('../../lib/db.js');
  await ensureDb();
  const cols = await h.q`SELECT column_name FROM information_schema.columns WHERE table_name = 'group_members' AND column_name = 'last_read_message_id'`;
  assert.equal(cols.length, 1);
});
