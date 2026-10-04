// Kolejka zapisów offline (POM-14, lib/offline-queue.js) i czas zapisu z kolejki (lib/ids.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, memoryStorage, classify, backoff, itemLabel, pendingText, revertOf, RETRY_MAX_MS } from '../lib/offline-queue.js';
import { clientAt, otherAccount, CLIENT_AT_MAX_MS } from '../lib/ids.js';

const usage = (id, grams = 0.5, extra = {}) => ({ id, kind: 'usage', url: '/api/strains/1/usage', method: 'POST', body: { grams, requestId: id }, meta: { strainId: 1, grams, unit: 'g', name: 'Lemon Skunk', delta: grams }, ...extra });
const symptoms = (id, day, pain) => ({ id, kind: 'symptoms', url: '/api/symptoms', method: 'PUT', body: { day, pain }, meta: { day } });

// atrapa serwera: kolejne odpowiedzi z listy (status albo 'net' = wyjątek sieci), zapis wysłanych identyfikatorów
function server(responses = []) {
  const calls = [];
  const send = async (item) => {
    calls.push(item.id);
    const r = responses.length ? responses.shift() : 200;
    if (r === 'net') throw new TypeError('Failed to fetch');
    return { status: r, data: r < 300 ? { id: 1, current: 2 } : { error: `Błąd ${r}` } };
  };
  return { send, calls };
}

function setup({ responses, userId = 7, storage = memoryStorage(), clock = { t: 1_000_000 } } = {}) {
  const srv = server(responses);
  const events = [];
  const q = createQueue({ storage, send: srv.send, userId, now: () => clock.t, onEvent: (e) => { if (e.type !== 'change') events.push(e); } });
  return { q, srv, events, storage, clock };
}

test('classify: 2xx ok, 401/403 czekają na logowanie, 5xx/408/429 ponawiamy, reszta 4xx odrzucona', () => {
  assert.equal(classify(200), 'ok');
  assert.equal(classify(201), 'ok');
  assert.equal(classify(401), 'auth');
  assert.equal(classify(403), 'auth');
  for (const s of [500, 502, 503, 408, 425, 429, 0]) assert.equal(classify(s), 'retry', String(s));
  for (const s of [400, 404, 409, 422]) assert.equal(classify(s), 'reject', String(s));
});

test('backoff rośnie wykładniczo do limitu', () => {
  assert.equal(backoff(1), 5000);
  assert.equal(backoff(2), 10000);
  assert.equal(backoff(3), 20000);
  assert.equal(backoff(30), RETRY_MAX_MS);
});

test('wysyła w kolejności dodania i opróżnia magazyn', async () => {
  const { q, srv, events, storage } = setup();
  await q.init();
  await q.add(usage('a'));
  await q.add(usage('b'));
  await q.add(usage('c'));
  const r = await q.flush();
  assert.deepEqual(srv.calls, ['a', 'b', 'c']);
  assert.equal(r.sent, 3);
  assert.equal(storage.size(), 0);
  assert.deepEqual(events.map((e) => `${e.type}:${e.item.id}`), ['sent:a', 'sent:b', 'sent:c']);
  assert.equal(q.state().pending, 0);
});

test('błąd sieci i 5xx zatrzymują kolejkę (kolejność), ponowienie z rosnącą przerwą', async () => {
  const { q, srv, clock } = setup({ responses: ['net', 503, 200, 200] });
  await q.init();
  await q.add(usage('a'));
  await q.add(usage('b'));
  let r = await q.flush();
  assert.deepEqual(srv.calls, ['a'], 'po błędzie nie wysyłamy kolejnych');
  assert.equal(r.retryIn, 5000);
  assert.equal(q.state().pending, 2);
  assert.equal(q.state().items[0].attempts, 1);

  r = await q.flush(); // za wcześnie: czekamy na przerwę
  assert.deepEqual(srv.calls, ['a']);
  clock.t += 5000;
  r = await q.flush();
  assert.deepEqual(srv.calls, ['a', 'a'], '503: ta sama pozycja zostaje');
  assert.equal(r.retryIn, 10000);
  r = await q.flush({ force: true }); // powrót sieci / powrót do karty: bez czekania
  assert.deepEqual(srv.calls, ['a', 'a', 'a', 'b']);
  assert.equal(r.sent, 2);
  assert.equal(q.state().pending, 0);
});

test('4xx: pozycja odrzucona z komunikatem serwera, kolejne idą dalej', async () => {
  const { q, events, storage } = setup({ responses: [404, 200] });
  await q.init();
  await q.add(usage('a'));
  await q.add(usage('b'));
  const r = await q.flush();
  assert.equal(r.rejected, 1);
  assert.equal(r.sent, 1);
  assert.equal(storage.size(), 0);
  const rej = events.find((e) => e.type === 'rejected');
  assert.equal(rej.item.id, 'a');
  assert.equal(rej.message, 'Błąd 404');
  assert.equal(rej.status, 404);
});

test('401: kolejka czeka na zalogowanie i niczego nie usuwa', async () => {
  const { q, srv, storage } = setup({ responses: [401, 200] });
  await q.init();
  await q.add(usage('a'));
  const r = await q.flush();
  assert.equal(r.blocked, 'auth');
  assert.equal(storage.size(), 1);
  assert.equal(q.state().blocked, 'auth');
  await q.flush();
  assert.deepEqual(srv.calls, ['a', 'a']);
  assert.equal(storage.size(), 0);
  assert.equal(q.state().blocked, null);
});

test('zmiana użytkownika: zapisy innego konta usuwane bez wysyłania', async () => {
  const storage = memoryStorage();
  const a = setup({ storage, userId: 7 });
  await a.q.init();
  await a.q.add(usage('ania-1'));
  const b = setup({ storage, userId: 8 });
  const dropped = await b.q.init();
  assert.equal(dropped, 1);
  assert.equal(storage.size(), 0);
  await b.q.flush();
  assert.deepEqual(b.srv.calls, []);
  // ten sam użytkownik po ponownym uruchomieniu (start aplikacji) widzi i wysyła swoją kolejkę
  await a.q.add(usage('ania-2'));
  const a2 = setup({ storage, userId: 7 });
  assert.equal(await a2.q.init(), 0);
  await a2.q.flush();
  assert.deepEqual(a2.srv.calls, ['ania-2']);
});

test('pozycja zapisuje userId i czas dodania', async () => {
  const { q } = setup({ userId: '7' });
  await q.init();
  const it = await q.add(usage('a'));
  assert.equal(it.userId, 7);
  assert.equal(it.createdAt, 1_000_000);
  assert.equal(it.seq, 1);
});

test('remove: „Cofnij” usuwa czekający zapis, ale nie ten w trakcie wysyłania', async () => {
  let release;
  const storage = memoryStorage();
  const events = [];
  const q = createQueue({
    storage, userId: 1, onEvent: (e) => events.push(e),
    send: (item) => (item.id === 'a' ? new Promise((res) => { release = () => res({ status: 200, data: {} }); }) : Promise.resolve({ status: 200, data: {} })),
  });
  await q.init();
  await q.add(usage('a'));
  await q.add(usage('b'));
  await q.add(usage('c'));
  assert.equal(await q.remove('c'), true);
  assert.ok(events.some((e) => e.type === 'removed' && e.item.id === 'c'));
  const p = q.flush();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(q.state().sending, 'a');
  assert.equal(await q.remove('a'), false, 'w locie: serwer mógł już zapisać');
  release();
  await p;
  assert.equal(storage.size(), 0);
  assert.equal(await q.remove('nie-ma'), false);
});

test('flush jest pojedynczy: równoległe wywołania nie wysyłają dwa razy', async () => {
  const { q, srv } = setup();
  await q.init();
  await q.add(usage('a'));
  await Promise.all([q.flush(), q.flush(), q.flush()]);
  assert.deepEqual(srv.calls, ['a']);
});

test('objawy jednego dnia: nowszy wpis zastępuje czekający, inne dni zostają', async () => {
  const { q, srv } = setup();
  await q.init();
  await q.add(symptoms('s1', '2026-10-03', 3));
  await q.add(usage('u1'));
  await q.add(symptoms('s2', '2026-10-03', 5));
  await q.add(symptoms('s3', '2026-10-02', 1));
  assert.deepEqual(q.state().items.map((i) => i.id), ['u1', 's2', 's3']);
  await q.flush();
  assert.deepEqual(srv.calls, ['u1', 's2', 's3']);
});

test('clear czyści magazyn i stan', async () => {
  const { q, storage } = setup({ responses: [401] });
  await q.init();
  await q.add(usage('a'));
  await q.flush();
  await q.clear();
  assert.equal(storage.size(), 0);
  assert.equal(q.state().pending, 0);
  assert.equal(q.state().blocked, null);
});

test('nieznany rodzaj zapisu jest odrzucany', async () => {
  const { q } = setup();
  await q.init();
  await assert.rejects(q.add({ id: 'x', kind: 'notes' }));
});

test('itemLabel: tryb dyskretny bez nazwy odmiany', () => {
  const u = usage('a', 0.25);
  assert.equal(itemLabel(u), 'Zużycie −0,25 g, Lemon Skunk');
  assert.equal(itemLabel(u, true), 'Zużycie −0,25 g');
  const p = { kind: 'purchase', meta: { grams: 10, unit: 'ml', name: 'Bediol' } };
  assert.equal(itemLabel(p), 'Wykup +10 ml, Bediol');
  assert.equal(itemLabel(p, true), 'Wykup +10 ml');
  assert.equal(itemLabel(symptoms('s', '2026-10-03', 1), true), 'Objawy z 03.10');
});

test('pendingText: polska odmiana', () => {
  assert.equal(pendingText(1), '1 zapis czeka na wysłanie');
  assert.equal(pendingText(2), '2 zapisy czekają na wysłanie');
  assert.equal(pendingText(5), '5 zapisów czeka na wysłanie');
  assert.equal(pendingText(12), '12 zapisów czeka na wysłanie');
  assert.equal(pendingText(22), '22 zapisy czekają na wysłanie');
});

test('revertOf: cofnięcie stanu pokazanego od razu', () => {
  assert.deepEqual(revertOf({ kind: 'usage', meta: { grams: 1, delta: 0.4 } }), { dCur: 0.4, dRem: 0, used: -1 });
  assert.deepEqual(revertOf({ kind: 'purchase', meta: { grams: 5, delta: 5, poolDelta: 3 } }), { dCur: -5, dRem: 3, bought: -5 });
  assert.equal(revertOf({ kind: 'symptoms', meta: {} }), null);
});

test('clientAt: czas z kolejki tylko z ostatnich 72 h i nie z przyszłości', () => {
  const now = Date.parse('2026-10-03T10:00:00Z');
  assert.equal(clientAt(now - 3600e3, now).toISOString(), '2026-10-03T09:00:00.000Z');
  assert.equal(clientAt('2026-10-02T22:50:00Z', now).toISOString(), '2026-10-02T22:50:00.000Z');
  assert.equal(clientAt(now + 1000, now), null);
  assert.equal(clientAt(now - CLIENT_AT_MAX_MS - 1, now), null);
  assert.equal(clientAt('bzdura', now), null);
  assert.equal(clientAt(null, now), null);
  assert.equal(clientAt('', now), null);
});

test('otherAccount: userId w treści różny od zalogowanego', () => {
  assert.equal(otherAccount({ userId: 2 }, { id: 2 }), false);
  assert.equal(otherAccount({ userId: '2' }, { id: 2 }), false);
  assert.equal(otherAccount({}, { id: 2 }), false);
  assert.equal(otherAccount({ userId: 3 }, { id: 2 }), true);
});
