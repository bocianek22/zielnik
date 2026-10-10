// SPO-3: role w grupach (owner / moderator / member): nadawanie i odbieranie moderatora, wyrzucanie członków,
// usuwanie wiadomości czatu przez moderatora, przekazanie własności, brak eskalacji uprawnień, 404/403 dla obcych.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { setup, skip } from './harness.mjs';

let h, G, G2;
const GR = 'groups/[id]', MSG = 'groups/[id]/messages', ONE = 'groups/[id]/messages/[mid]';
const p = (id, mid) => ({ id: String(id), ...(mid && { mid: String(mid) }) });

before(async () => {
  if (skip) return;
  h = await setup(['ania', 'bartek', 'celina', 'darek', 'ewa', 'adm']);
  const { q, ids } = h;
  // G: ania (właściciel), bartek (członek), celina (członek), ewa (członek); darek jest obcy
  [{ id: G }] = await q`INSERT INTO groups (name, owner_id) VALUES ('Grupa ról', ${ids.ania}) RETURNING id`;
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES
    (${G}, ${ids.ania}, 'owner', 'active'), (${G}, ${ids.bartek}, 'member', 'active'),
    (${G}, ${ids.celina}, 'member', 'active'), (${G}, ${ids.ewa}, 'member', 'active')`;
  [{ id: G2 }] = await q`INSERT INTO groups (name, owner_id) VALUES ('Cudza grupa', ${ids.darek}) RETURNING id`;
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G2}, ${ids.darek}, 'owner', 'active'), (${G2}, ${ids.ewa}, 'member', 'active')`;
});
after(async () => { if (h) await h.pool.end(); });

const act = (uid, body, gid = G) => h.call(uid, GR, 'POST', body, p(gid));
const role = async (uid, gid = G) => (await h.q`SELECT role FROM group_members WHERE group_id = ${gid} AND user_id = ${uid}`)[0]?.role;
const say = async (uid, text, gid = G) => (await h.call(uid, MSG, 'POST', { body: text }, p(gid))).json.message.id;

test('moderatora nadaje i odbiera tylko właściciel; zwykły członek i moderator nie', { skip }, async () => {
  const { ids } = h;
  // członek nie może nadać roli (sobie ani innym)
  assert.equal((await act(ids.bartek, { action: 'mod', userId: ids.bartek })).status, 403);
  assert.equal((await act(ids.bartek, { action: 'mod', userId: ids.celina })).status, 403);
  assert.equal(await role(ids.bartek), 'member');
  // obcy: 403 (nie jest członkiem), nic się nie zmienia
  assert.equal((await act(ids.darek, { action: 'mod', userId: ids.bartek })).status, 403);
  assert.equal(await role(ids.bartek), 'member');
  // właściciel nadaje
  const ok = await act(ids.ania, { action: 'mod', userId: ids.bartek });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(await role(ids.bartek), 'moderator');
  // moderator nie nadaje ani nie odbiera ról
  assert.equal((await act(ids.bartek, { action: 'mod', userId: ids.celina })).status, 403);
  assert.equal((await act(ids.bartek, { action: 'unmod', userId: ids.bartek })).status, 403);
  assert.equal(await role(ids.celina), 'member');
  assert.equal(await role(ids.bartek), 'moderator');
  // właściciel nie zmienia własnej roli i nie nadaje moderatora nieistniejącemu członkowi, zaproszonemu, ani z innej grupy
  assert.equal((await act(ids.ania, { action: 'mod', userId: ids.ania })).status, 400);
  assert.equal(await role(ids.ania), 'owner');
  assert.equal((await act(ids.ania, { action: 'mod', userId: ids.darek })).status, 404, 'obcy człowiek w grupie G');
  assert.equal(await role(ids.darek, G), undefined);
  await h.q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.adm}, 'member', 'invited')`;
  assert.equal((await act(ids.ania, { action: 'mod', userId: ids.adm })).status, 404, 'zaproszony bez przyjęcia nie jest moderatorem');
  assert.equal(await role(ids.adm), 'member');
  await h.q`DELETE FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`;
  // właściciel cudzej grupy nie ma władzy w G
  assert.equal((await act(ids.darek, { action: 'mod', userId: ids.celina }, G2)).status, 404, 'celina nie jest w G2');
  // odebranie
  assert.equal((await act(ids.ania, { action: 'unmod', userId: ids.bartek })).status, 200);
  assert.equal(await role(ids.bartek), 'member');
  assert.equal((await act(ids.ania, { action: 'unmod', userId: ids.bartek })).status, 404, 'już nie jest moderatorem');
  await act(ids.ania, { action: 'mod', userId: ids.bartek });
});

test('moderator usuwa wiadomości zwykłych członków (nie właściciela); zwykły członek nie; canDelete zgodne z rolą', { skip }, async () => {
  const { ids, q } = h;
  await q`DELETE FROM rate_limits`;
  const a = await say(ids.ania, 'wiadomość właściciela');
  const c = await say(ids.celina, 'wiadomość celiny');
  const e = await say(ids.ewa, 'wiadomość ewy');
  // lista dla moderatora: zwykłych członków tak, właściciela nie (ta sama hierarchia co przy usuwaniu z grupy)
  const asMod = (await h.call(ids.bartek, MSG, 'GET', undefined, p(G))).json.messages;
  assert.deepEqual(asMod.map((m) => m.canDelete), [false, true, true]);
  const asMember = (await h.call(ids.celina, MSG, 'GET', undefined, p(G))).json.messages;
  assert.deepEqual(asMember.map((m) => [m.name, m.canDelete]), [['ania', false], ['celina', true], ['ewa', false]]);
  // zwykły członek: 403, wiadomość zostaje
  assert.equal((await h.call(ids.ewa, ONE, 'DELETE', undefined, p(G, c))).status, 403);
  assert.equal((await q`SELECT deleted_at FROM group_messages WHERE id = ${c}`)[0].deleted_at, null);
  // moderator: zwykłego członka tak, właściciela nie (403, wiadomość zostaje)
  assert.equal((await h.call(ids.bartek, ONE, 'DELETE', undefined, p(G, c))).status, 200);
  assert.equal((await h.call(ids.bartek, ONE, 'DELETE', undefined, p(G, a))).status, 403);
  assert.equal((await q`SELECT deleted_at FROM group_messages WHERE id = ${a}`)[0].deleted_at, null);
  const rows = await q`SELECT id, body, deleted_at, deleted_by FROM group_messages WHERE id IN (${c})`;
  for (const r of rows) { assert.equal(r.body, ''); assert.ok(r.deleted_at); assert.equal(r.deleted_by, ids.bartek); }
  // moderator innej grupy nie ma władzy w G: ewa jest moderatorem w G2, w G zostaje zwykłym członkiem
  await q`UPDATE group_members SET role = 'moderator' WHERE group_id = ${G2} AND user_id = ${ids.ewa}`;
  assert.equal((await h.call(ids.ewa, ONE, 'DELETE', undefined, p(G, e))).status, 200, 'własna wiadomość autor usuwa zawsze');
  const c2 = await say(ids.celina, 'druga celiny');
  assert.equal((await h.call(ids.ewa, ONE, 'DELETE', undefined, p(G, c2))).status, 403, 'rola z G2 nie działa w G');
  assert.equal((await h.call(ids.ewa, ONE, 'DELETE', undefined, p(G2, c2))).status, 404, 'wiadomość z G nie jest dostępna przez adres G2');
  await q`UPDATE group_members SET role = 'member' WHERE group_id = ${G2} AND user_id = ${ids.ewa}`;
  // odebrany moderator traci prawo od razu
  await act(ids.ania, { action: 'unmod', userId: ids.bartek });
  assert.equal((await h.call(ids.bartek, ONE, 'DELETE', undefined, p(G, c2))).status, 403);
  assert.equal((await h.call(ids.bartek, MSG, 'GET', undefined, p(G))).json.messages.find((m) => m.id === c2).canDelete, false);
  await act(ids.ania, { action: 'mod', userId: ids.bartek });
});

test('wyrzucanie: właściciel każdego (poza sobą), moderator tylko zwykłych członków, członek nikogo', { skip }, async () => {
  const { ids, q } = h;
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.darek}, 'moderator', 'active')`;
  // zwykły członek nie wyrzuca
  assert.equal((await act(ids.celina, { action: 'kick', userId: ids.ewa })).status, 403);
  assert.equal(await role(ids.ewa), 'member');
  // moderator: nie właściciela, nie innego moderatora, nie siebie
  assert.equal((await act(ids.bartek, { action: 'kick', userId: ids.ania })).status, 403);
  assert.equal((await act(ids.bartek, { action: 'kick', userId: ids.darek })).status, 403);
  assert.equal((await act(ids.bartek, { action: 'kick', userId: ids.bartek })).status, 400);
  assert.equal(await role(ids.ania), 'owner');
  assert.equal(await role(ids.darek), 'moderator');
  // moderator wyrzuca zwykłego członka (celina), właściciel moderatora
  assert.equal((await act(ids.bartek, { action: 'kick', userId: ids.celina })).status, 200);
  assert.equal(await role(ids.celina), undefined);
  assert.equal((await act(ids.ania, { action: 'kick', userId: ids.darek })).status, 200);
  assert.equal(await role(ids.darek), undefined);
  // właściciel nie wyrzuca siebie; wyrzucenie nieistniejącego członka = 404
  assert.equal((await act(ids.ania, { action: 'kick', userId: ids.ania })).status, 400);
  assert.equal((await act(ids.ania, { action: 'kick', userId: ids.darek })).status, 404);
  // wyrzucenie nie sięga do innej grupy o tym samym użytkowniku (ewa jest też w G2)
  assert.equal((await act(ids.bartek, { action: 'kick', userId: ids.ewa })).status, 200);
  assert.equal(await role(ids.ewa, G2), 'member');
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.celina}, 'member', 'active'), (${G}, ${ids.ewa}, 'member', 'active')`;
});

test('zapraszanie: aktywny członek i moderator tak, zaproszony bez przyjęcia nie', { skip }, async () => {
  const { ids, q } = h;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.bartek}, ${ids.adm}, 'accepted')`;
  assert.equal((await act(ids.bartek, { action: 'invite', username: 'adm' })).status, 200, 'moderator zaprasza znajomego');
  assert.equal((await q`SELECT status, role FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`)[0].role, 'member', 'zaproszony zawsze jako member');
  await q`DELETE FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`;
  // zaproszony bez przyjęcia nie zaprasza
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.darek}, 'member', 'invited')`;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.darek}, ${ids.adm}, 'accepted')`;
  assert.equal((await act(ids.darek, { action: 'invite', username: 'adm' })).status, 403);
  await q`DELETE FROM group_members WHERE group_id = ${G} AND user_id = ${ids.darek}`;
});

test('zasada zapraszania: zmieniają ją właściciel i moderator; przy „staff” zwykły członek nie zaprasza, moderator tak; usuwanie zaproszeń', { skip }, async () => {
  const { ids, q } = h;
  const was = await role(ids.bartek);
  await q`UPDATE group_members SET role = 'moderator' WHERE group_id = ${G} AND user_id = ${ids.bartek}`;
  const policy = async () => (await q`SELECT invite_policy FROM groups WHERE id = ${G}`)[0].invite_policy;
  assert.equal(await policy(), 'all', 'domyślnie zaprasza każdy');
  // zwykły członek nie zmienia zasady, błędna wartość odrzucona, obcy dostaje 403
  assert.equal((await act(ids.celina, { action: 'invitePolicy', policy: 'staff' })).status, 403);
  assert.equal((await act(ids.bartek, { action: 'invitePolicy', policy: 'admin' })).status, 400);
  assert.equal((await act(ids.darek, { action: 'invitePolicy', policy: 'staff' })).status, 403);
  assert.equal((await act(ids.darek, { action: 'invitePolicy', policy: 'staff' }, G2)).status, 200, 'właściciel własnej grupy');
  assert.equal(await policy(), 'all', 'zmiana w innej grupie nie dotyka tej');
  // moderator przełącza na „staff”
  assert.equal((await act(ids.bartek, { action: 'invitePolicy', policy: 'staff' })).status, 200);
  assert.equal(await policy(), 'staff');
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.celina}, ${ids.adm}, 'accepted')`;
  const r = await act(ids.celina, { action: 'invite', username: 'adm' });
  assert.equal(r.status, 403);
  assert.match(r.json.error, /tylko właściciel i moderatorzy/);
  assert.equal((await q`SELECT 1 FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`).length, 0);
  // moderator zaprasza, a potem usuwa oczekujące zaproszenie
  assert.equal((await act(ids.bartek, { action: 'invite', username: 'adm' })).status, 200);
  assert.equal((await q`SELECT status FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`)[0].status, 'invited');
  assert.equal((await act(ids.bartek, { action: 'kick', userId: ids.adm })).status, 200);
  assert.equal((await q`SELECT 1 FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`).length, 0);
  // po odebraniu roli moderatora bartek nie zmienia już zasady; właściciel przywraca „all” i członek znów zaprasza
  await q`UPDATE group_members SET role = 'member' WHERE group_id = ${G} AND user_id = ${ids.bartek}`;
  assert.equal((await act(ids.bartek, { action: 'invitePolicy', policy: 'all' })).status, 403);
  assert.equal((await act(ids.ania, { action: 'invitePolicy', policy: 'all' })).status, 200);
  assert.equal((await act(ids.celina, { action: 'invite', username: 'adm' })).status, 200);
  await q`DELETE FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`;
  await q`UPDATE group_members SET role = ${was} WHERE group_id = ${G} AND user_id = ${ids.bartek}`;
});

test('przekazanie własności: tylko właściciel, tylko aktywnemu członkowi; role i owner_id zmieniają się razem', { skip }, async () => {
  const { ids, q } = h;
  const owner = async () => (await q`SELECT owner_id FROM groups WHERE id = ${G}`)[0].owner_id;
  // nie-właściciele nie przekazują (także sobie)
  assert.equal((await act(ids.bartek, { action: 'transfer', userId: ids.bartek })).status, 403);
  assert.equal((await act(ids.celina, { action: 'transfer', userId: ids.celina })).status, 403);
  assert.equal((await act(ids.darek, { action: 'transfer', userId: ids.darek })).status, 403, 'obcy');
  assert.equal(await owner(), ids.ania);
  // nie sobie, nie obcemu, nie zaproszonemu
  assert.equal((await act(ids.ania, { action: 'transfer', userId: ids.ania })).status, 400);
  assert.equal((await act(ids.ania, { action: 'transfer', userId: ids.darek })).status, 404);
  await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${G}, ${ids.adm}, 'member', 'invited')`;
  assert.equal((await act(ids.ania, { action: 'transfer', userId: ids.adm })).status, 404);
  await q`DELETE FROM group_members WHERE group_id = ${G} AND user_id = ${ids.adm}`;
  assert.equal(await owner(), ids.ania);
  // limit 10 grup na właściciela dotyczy też przejmującego
  for (let i = 0; i < 10; i++) await q`INSERT INTO groups (name, owner_id) VALUES (${'pełna ' + i}, ${ids.celina})`;
  assert.equal((await act(ids.ania, { action: 'transfer', userId: ids.celina })).status, 400);
  await q`DELETE FROM groups WHERE owner_id = ${ids.celina}`;
  // przekazanie moderatorowi (bartek): on zostaje właścicielem, dotychczasowa właścicielka członkiem
  const ok = await act(ids.ania, { action: 'transfer', userId: ids.bartek });
  assert.equal(ok.status, 200, JSON.stringify(ok.json));
  assert.equal(await role(ids.bartek), 'owner');
  assert.equal(await role(ids.ania), 'member');
  assert.equal(await owner(), ids.bartek);
  assert.equal((await q`SELECT count(*)::int AS n FROM group_members WHERE group_id = ${G} AND role = 'owner'`)[0].n, 1, 'dokładnie jeden właściciel');
  // dawna właścicielka traci uprawnienia, nowy je ma
  assert.equal((await act(ids.ania, { action: 'mod', userId: ids.celina })).status, 403);
  assert.equal((await act(ids.ania, { action: 'transfer', userId: ids.ewa })).status, 403);
  assert.equal((await act(ids.bartek, { action: 'mod', userId: ids.ania })).status, 200);
  assert.equal(await role(ids.ania), 'moderator');
  // wrócić
  assert.equal((await act(ids.bartek, { action: 'transfer', userId: ids.ania })).status, 200);
  assert.equal(await owner(), ids.ania);
  assert.equal(await role(ids.bartek), 'member');
});

test('właściciel z członkami nadal nie opuści grupy, ale komunikat wskazuje przekazanie; moderator opuszcza jak członek', { skip }, async () => {
  const { ids } = h;
  const r = await act(ids.ania, { action: 'leave' });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /Przekaż/);
  await act(ids.ania, { action: 'mod', userId: ids.celina });
  assert.equal((await act(ids.celina, { action: 'leave' })).status, 200);
  assert.equal(await role(ids.celina), undefined);
});

test('lista grup i eksport pokazują rolę moderatora', { skip }, async () => {
  const { ids } = h;
  await act(ids.ania, { action: 'mod', userId: ids.bartek });
  const l = await h.call(ids.bartek, 'groups', 'GET');
  assert.equal(l.json.groups.find((g) => g.id === G).role, 'moderator');
  const exp = await h.call(ids.bartek, 'account/export', 'GET');
  assert.equal(exp.status, 200);
  assert.equal(exp.json.groups.find((g) => g.name === 'Grupa ról').role, 'moderator');
});
