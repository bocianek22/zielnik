// Wyszukiwarka użytkowników szanuje prywatność profilu: profil „tylko ja” jest ukryty, chyba że szukający jest znajomym.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { setup, skip } from './harness.mjs';

let h;
before(async () => {
  if (skip) return;
  h = await setup(['szukaj', 'gosia_ukryta', 'gosia_znajoma', 'gosia_zaproszona', 'gosia_jawna', 'gosia_fof', 'gosia_zablokowana']);
  const { q, ids } = h;
  await q`UPDATE users SET profile_visibility = 'me' WHERE username IN ('gosia_ukryta', 'gosia_znajoma', 'gosia_zaproszona')`;
  await q`UPDATE users SET profile_visibility = 'all' WHERE username = 'gosia_jawna'`;
  await q`UPDATE users SET profile_visibility = 'fof' WHERE username = 'gosia_fof'`;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.szukaj}, ${ids.gosia_znajoma}, 'accepted')`;
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.gosia_zaproszona}, ${ids.szukaj}, 'pending')`;
  await q`INSERT INTO blocks (blocker, blocked) VALUES (${ids.gosia_zablokowana}, ${ids.szukaj})`;
});
after(async () => { if (h) await h.pool.end(); });

const names = (r) => r.json.users.map((u) => u.username).sort();

test('wyszukiwarka pomija profile „tylko ja”, z wyjątkiem zaakceptowanych znajomych', { skip }, async () => {
  const r = await h.call(h.ids.szukaj, 'users/search', 'GET', undefined, {}, '?q=gosia');
  assert.equal(r.status, 200);
  // ukryta: brak; zaproszona (tylko oczekujące zaproszenie, profil „tylko ja”): brak; zablokowana: brak
  assert.deepEqual(names(r), ['gosia_fof', 'gosia_jawna', 'gosia_znajoma']);
});

test('ukryte konto nie wyświetla się też po nazwie wyświetlanej, a po zostaniu znajomym tak', { skip }, async () => {
  const { q, ids, call } = h;
  await q`UPDATE users SET display_name = 'Tajemnicza Basia' WHERE id = ${ids.gosia_ukryta}`;
  assert.deepEqual(names(await call(ids.szukaj, 'users/search', 'GET', undefined, {}, '?q=tajemnicza')), []);
  await q`INSERT INTO friendships (requester, addressee, status) VALUES (${ids.gosia_ukryta}, ${ids.szukaj}, 'accepted')`;
  assert.deepEqual(names(await call(ids.szukaj, 'users/search', 'GET', undefined, {}, '?q=tajemnicza')), ['gosia_ukryta']);
});

test('użytkownik z profilem „tylko ja” sam siebie nie szuka (bez zmian), a krótkie zapytanie zwraca pustą listę', { skip }, async () => {
  const { call, ids } = h;
  assert.equal(names(await call(ids.gosia_znajoma, 'users/search', 'GET', undefined, {}, '?q=gosia')).includes('gosia_znajoma'), false);
  assert.deepEqual((await call(ids.szukaj, 'users/search', 'GET', undefined, {}, '?q=g')).json.users, []);
});
