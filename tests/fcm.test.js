// lib/fcm.js: konfiguracja z FIREBASE_SERVICE_ACCOUNT, token OAuth (JWT RS256, cache), wysyłka HTTP v1 z podmienionym fetch.
import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { decodeProtectedHeader, importSPKI, jwtVerify } from 'jose';
import { accessToken, buildMessage, fcmConfig, fcmEnabled, resetFcmCache, sendFcm } from '../lib/fcm.js';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const ACCOUNT = { project_id: 'zielnik-test', client_email: 'push@zielnik-test.iam.gserviceaccount.com', private_key: privateKey };
const realFetch = globalThis.fetch;
const realEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
let calls, tokenCount;

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
// handler(url, init) dla wiadomości; token OAuth obsługuje stub sam
function stub(handler, expiresIn = 3600) {
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url) === 'https://oauth2.googleapis.com/token') { tokenCount++; return json(200, { access_token: `tok${tokenCount}`, expires_in: expiresIn }); }
    return handler(String(url), init);
  };
}

beforeEach(() => { calls = []; tokenCount = 0; process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify(ACCOUNT); resetFcmCache(); });
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realEnv === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT; else process.env.FIREBASE_SERVICE_ACCOUNT = realEnv;
});

test('bez zmiennej FCM jest wyłączony i nic nie wysyła', async () => {
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  stub(() => { throw new Error('nie powinno być żądań'); });
  assert.equal(fcmEnabled(), false);
  assert.equal(await sendFcm('x'.repeat(30), { title: 'Z', body: 'b' }), false);
  assert.equal(calls.length, 0);
});

test('konfiguracja: JSON i base64, zły JSON lub brak pól = wyłączony', () => {
  assert.equal(fcmConfig().projectId, 'zielnik-test');
  process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(ACCOUNT)).toString('base64');
  assert.equal(fcmConfig().email, ACCOUNT.client_email);
  const err = console.error; console.error = () => {};
  try {
    for (const bad of ['{nie json', '{"project_id":"x"}']) { process.env.FIREBASE_SERVICE_ACCOUNT = bad; assert.equal(fcmEnabled(), false, bad); }
  } finally { console.error = err; }
});

test('token OAuth: JWT RS256 z właściwymi polami, cache do wygaśnięcia, odświeżenie po wygaśnięciu', async () => {
  stub(() => json(200, {}));
  const [t1, t2] = await Promise.all([accessToken(), accessToken()]); // równoległe wywołania = jedno żądanie
  assert.equal(t1, 'tok1'); assert.equal(t2, 'tok1');
  assert.equal(await accessToken(), 'tok1');
  assert.equal(tokenCount, 1);

  const body = new URLSearchParams(String(calls[0].init.body));
  assert.equal(body.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  const jwt = body.get('assertion');
  assert.equal(decodeProtectedHeader(jwt).alg, 'RS256');
  const { payload } = await jwtVerify(jwt, await importSPKI(publicKey, 'RS256'), { audience: 'https://oauth2.googleapis.com/token', issuer: ACCOUNT.client_email });
  assert.equal(payload.scope, 'https://www.googleapis.com/auth/firebase.messaging');
  assert.equal(payload.sub, ACCOUNT.client_email);
  assert.ok(payload.exp - payload.iat <= 3600);

  resetFcmCache(); tokenCount = 0;
  stub(() => json(200, {}), 30); // krótszy niż margines 60 s: każde wywołanie odświeża
  assert.equal(await accessToken(), 'tok1');
  assert.equal(await accessToken(), 'tok2');
});

test('błąd tokenu OAuth nie zostaje w cache jako token', async () => {
  const err = console.error; console.error = () => {};
  globalThis.fetch = async () => json(400, { error: 'invalid_grant' });
  try { await assert.rejects(accessToken(), /tokenu OAuth \(400\)/); } finally { console.error = err; }
  resetFcmCache(); // pamięć błędu (60 s) zostaje, jej wygaśnięcie symulujemy resetem
  stub(() => json(200, {}));
  assert.equal(await accessToken(), 'tok1');
});

test('wysyłka: adres projektu, nagłówek Bearer, treść bez nazw odmian i url w data', async () => {
  stub(() => json(200, { name: 'projects/zielnik-test/messages/1' }));
  const payload = { title: 'Zielnik', body: 'Masz 2 przypomnienia. Otwórz aplikację, aby zobaczyć szczegóły.', url: '/recepty', tag: 'zielnik-przypomnienia' };
  assert.equal(await sendFcm('T'.repeat(40), payload), true);
  const send = calls.find((c) => c.url.includes('messages:send'));
  assert.equal(send.url, 'https://fcm.googleapis.com/v1/projects/zielnik-test/messages:send');
  assert.equal(send.init.headers.Authorization, 'Bearer tok1');
  const { message } = JSON.parse(send.init.body);
  assert.equal(message.token, 'T'.repeat(40));
  assert.deepEqual(message.notification, { title: 'Zielnik', body: payload.body });
  assert.deepEqual(message.data, { url: '/recepty', tag: 'zielnik-przypomnienia' });
  assert.equal(message.android.notification.tag, 'zielnik-przypomnienia');
  assert.deepEqual(buildMessage('t', { title: 'a', body: 'b' }).data, {});
});

test('UNREGISTERED i 404 dają statusCode 404, inne błędy własny kod', async () => {
  stub(() => json(404, { error: { code: 404, status: 'NOT_FOUND', details: [{ errorCode: 'UNREGISTERED' }] } }));
  await assert.rejects(sendFcm('T'.repeat(40), { title: 'a' }), (e) => e.statusCode === 404 && /UNREGISTERED/.test(e.message));
  stub(() => json(400, { error: { status: 'UNREGISTERED' } }));
  await assert.rejects(sendFcm('T'.repeat(40), { title: 'a' }), (e) => e.statusCode === 404);
  stub(() => json(503, { error: { status: 'UNAVAILABLE' } }));
  await assert.rejects(sendFcm('T'.repeat(40), { title: 'a' }), (e) => e.statusCode === 503);
});

test('401 od FCM: jednorazowa ponowna próba z nowym tokenem OAuth', async () => {
  let n = 0;
  stub(() => (++n === 1 ? json(401, { error: { status: 'UNAUTHENTICATED' } }) : json(200, {})));
  assert.equal(await sendFcm('T'.repeat(40), { title: 'a' }), true);
  const auth = calls.filter((c) => c.url.includes('messages:send')).map((c) => c.init.headers.Authorization);
  assert.deepEqual(auth, ['Bearer tok1', 'Bearer tok2']);
});

const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const send = () => sendFcm('T'.repeat(40), { title: 'a' });

test('klasyfikacja: 403, 429, 5xx, timeout i błąd sieci są transient, usuwanie tylko dla nieważnego tokenu', async () => {
  await quiet(async () => {
    for (const [status, body] of [[403, { error: { status: 'PERMISSION_DENIED' } }], [429, { error: { status: 'QUOTA_EXCEEDED' } }], [500, {}], [503, {}]]) {
      stub(() => json(status, body));
      await assert.rejects(send(), (e) => e.transient === true && e.statusCode === status, String(status));
    }
    globalThis.fetch = async (url) => { if (String(url).includes('oauth2')) return json(200, { access_token: 't', expires_in: 3600 }); throw Object.assign(new Error('x'), { name: 'TimeoutError' }); };
    await assert.rejects(send(), (e) => e.transient === true && e.statusCode === undefined);
    stub(() => json(403, { error: { status: 'PERMISSION_DENIED', details: [{ errorCode: 'SENDER_ID_MISMATCH' }] } }));
    await assert.rejects(send(), (e) => e.statusCode === 404 && !e.transient);
    const violation = { '@type': 'type.googleapis.com/google.rpc.BadRequest', fieldViolations: [{ field: 'message.token' }] };
    stub(() => json(400, { error: { status: 'INVALID_ARGUMENT', details: [violation] } }));
    await assert.rejects(send(), (e) => e.statusCode === 404);
    stub(() => json(400, { error: { status: 'INVALID_ARGUMENT', details: [{ fieldViolations: [{ field: 'message.android.ttl' }] }] } }));
    await assert.rejects(send(), (e) => e.statusCode === 400 && !e.transient);
  });
});

test('nieudane OAuth: transient i zapamiętane na minutę (kolejne wywołania bez żądań)', async () => {
  await quiet(async () => {
    let n = 0;
    globalThis.fetch = async () => { n++; return json(500, {}); };
    await assert.rejects(send(), (e) => e.transient === true && !e.skipped);
    await assert.rejects(send(), (e) => e.transient === true && e.skipped === true);
    await assert.rejects(send(), (e) => e.skipped === true);
    assert.equal(n, 1);
    resetFcmCache(); // po wygaśnięciu pamięci (tu: reset) próbujemy znowu
    stub(() => json(200, {}));
    assert.equal(await send(), true);
  });
});

test('private_key z dosłownym "\\n" jest naprawiany, uszkodzony klucz wyłącza FCM', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ ...ACCOUNT, private_key: privateKey.replace(/\n/g, '\\n') });
  assert.equal(fcmConfig().privateKey, privateKey);
  stub(() => json(200, {}));
  assert.equal(await send(), true);
  await quiet(async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ ...ACCOUNT, private_key: '-----BEGIN PRIVATE KEY-----\nzepsuty\n-----END PRIVATE KEY-----\n' });
    assert.equal(fcmEnabled(), false);
  });
});

test('401 unieważnia tylko użyty token OAuth, nie cały cache', async () => {
  let n = 0;
  stub(() => (++n === 1 ? json(401, {}) : json(200, {})));
  assert.equal(await send(), true);
  assert.equal(await accessToken(), 'tok2'); // nowy token zostaje w cache
  assert.equal(tokenCount, 2);
  // token zdążył już wymienić ktoś inny: cudzego tokenu nie kasujemy
  resetFcmCache(); tokenCount = 0; n = 0;
  let other;
  stub(async () => { if (++n === 1) { resetFcmCache(); other = await accessToken(); return json(401, {}); } return json(200, {}); });
  assert.equal(await send(), true);
  assert.equal(other, 'tok2');
  assert.equal(tokenCount, 2); // retry użył tokenu z cache, bez trzeciej wymiany
});
