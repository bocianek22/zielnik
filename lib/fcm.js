import { SignJWT, importPKCS8 } from 'jose';

// Wysyłka powiadomień do aplikacji natywnej: Firebase Cloud Messaging HTTP v1 (konto usługi, bez SDK).
// Zmienna FIREBASE_SERVICE_ACCOUNT = JSON klucza konta usługi z Firebase (można też podać go jako base64).
// Bez niej wszystko tu jest wyłączone (jak push bez kluczy VAPID).
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token'; // stały adres, nie z pliku klucza
const TIMEOUT = 10000;
const EARLY = 60; // sekund przed wygaśnięciem tokenu OAuth odświeżamy go

let parsed = { raw: null, value: null };
// { projectId, email, privateKey } albo null (brak lub zły JSON)
export function fcmConfig() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  if (parsed.raw === raw) return parsed.value;
  let value = null;
  try {
    const j = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    if (j.project_id && j.client_email && j.private_key) value = { projectId: String(j.project_id), email: String(j.client_email), privateKey: String(j.private_key) };
    else console.error('FIREBASE_SERVICE_ACCOUNT: brak project_id, client_email lub private_key.');
  } catch { console.error('FIREBASE_SERVICE_ACCOUNT: nieprawidłowy JSON.'); }
  parsed = { raw, value };
  return value;
}
export const fcmEnabled = () => fcmConfig() !== null;

let cache = { key: null, token: null, exp: 0, pending: null };
export function resetFcmCache() { cache = { key: null, token: null, exp: 0, pending: null }; }

async function fetchToken(c) {
  const key = await importPKCS8(c.privateKey, 'RS256');
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(c.email).setSubject(c.email).setAudience(TOKEN_URL)
    .setIssuedAt().setExpirationTime('1h').sign(key);
  const res = await fetch(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.access_token) throw new Error(`FCM: nie udało się uzyskać tokenu OAuth (${res.status}).`);
  return { token: j.access_token, exp: Date.now() + (Number(j.expires_in) > 0 ? Number(j.expires_in) : 3600) * 1000 };
}

// Token dostępu z cache do wygaśnięcia; równoległe wywołania dzielą jedno żądanie
export async function accessToken(c = fcmConfig()) {
  if (!c) throw new Error('FCM nie jest skonfigurowany.');
  if (cache.key === c.email && cache.token && Date.now() < cache.exp - EARLY * 1000) return cache.token;
  if (cache.pending && cache.key === c.email) return cache.pending;
  const pending = fetchToken(c).then((t) => { cache = { key: c.email, token: t.token, exp: t.exp, pending: null }; return t.token; },
    (e) => { if (cache.pending === pending) cache = { ...cache, pending: null }; throw e; });
  cache = { key: c.email, token: null, exp: 0, pending };
  return pending;
}

// Komunikat FCM z neutralnej treści (te same pola co Web Push: title, body, url, tag). Wartości data muszą być tekstem.
export function buildMessage(token, payload) {
  const data = {};
  if (payload.url) data.url = String(payload.url);
  if (payload.tag) data.tag = String(payload.tag);
  return {
    token,
    notification: { title: String(payload.title ?? 'Zielnik'), body: String(payload.body ?? '') },
    data,
    android: { ttl: '43200s', priority: 'NORMAL', notification: payload.tag ? { tag: String(payload.tag) } : {} },
  };
}

// Wysyła do jednego tokenu. Wygasły token (UNREGISTERED / 404) rzuca błąd z statusCode 404, jak 410 w Web Push.
export async function sendFcm(token, payload) {
  const c = fcmConfig();
  if (!c) return false;
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(c.projectId)}/messages:send`;
  const body = JSON.stringify({ message: buildMessage(token, payload) });
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await fetch(url, {
      method: 'POST', headers: { Authorization: `Bearer ${await accessToken(c)}`, 'Content-Type': 'application/json' },
      body, signal: AbortSignal.timeout(TIMEOUT),
    });
    if (res.status !== 401 || attempt) break;
    resetFcmCache(); // unieważniony token OAuth: raz próbujemy z nowym
  }
  if (res.ok) return true;
  const j = await res.json().catch(() => ({}));
  const codes = [j?.error?.status, ...(j?.error?.details || []).map((d) => d?.errorCode)];
  const gone = res.status === 404 || codes.includes('UNREGISTERED');
  throw Object.assign(new Error(`FCM ${res.status} ${codes.filter(Boolean).join(' ')}`.trim()), { statusCode: gone ? 404 : res.status });
}
