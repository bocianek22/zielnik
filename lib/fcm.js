import { createPrivateKey } from 'node:crypto';
import { SignJWT, importPKCS8 } from 'jose';

// Wysyłka powiadomień do aplikacji natywnej: Firebase Cloud Messaging HTTP v1 (konto usługi, bez SDK).
// Zmienna FIREBASE_SERVICE_ACCOUNT = JSON klucza konta usługi z Firebase (można też podać go jako base64).
// Bez niej wszystko tu jest wyłączone (jak push bez kluczy VAPID).
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token'; // stały adres, nie z pliku klucza
const TIMEOUT = 10000;
const EARLY = 60; // sekund przed wygaśnięciem tokenu OAuth odświeżamy go
const FAIL_MS = 60000; // tyle pamiętamy nieudane OAuth, żeby pętla crona nie czekała na każdego użytkownika

// transient: błąd konfiguracji/usługi (nie wina tokenu urządzenia), nie liczy się do usuwania subskrypcji
const transient = (msg, extra = {}) => Object.assign(new Error(msg), { transient: true, ...extra });

let parsed = { raw: null, value: null };
// { projectId, email, privateKey } albo null (brak lub zły JSON)
export function fcmConfig() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (!raw) return null;
  if (parsed.raw === raw) return parsed.value;
  let value = null;
  try {
    const j = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    if (j.project_id && j.client_email && j.private_key) {
      // klucz wklejony z "\\n" zamiast prawdziwych nowych linii; próbny import wyłapuje uszkodzony klucz od razu
      const privateKey = String(j.private_key).replace(/\\n/g, '\n');
      if (createPrivateKey(privateKey).asymmetricKeyType !== 'rsa') throw new Error('klucz nie jest RSA');
      value = { projectId: String(j.project_id), email: String(j.client_email), privateKey };
    } else console.error('FIREBASE_SERVICE_ACCOUNT: brak project_id, client_email lub private_key.');
  } catch (e) { console.error(`FIREBASE_SERVICE_ACCOUNT: nieprawidłowa zawartość (${e?.message || 'błąd'}).`); }
  parsed = { raw, value };
  return value;
}
export const fcmEnabled = () => fcmConfig() !== null;

let cache = { key: null, token: null, exp: 0, pending: null, failUntil: 0 };
export function resetFcmCache() { cache = { key: null, token: null, exp: 0, pending: null, failUntil: 0 }; }

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
  if (cache.key === c.email && Date.now() < cache.failUntil) throw transient('FCM: wcześniejsze uzyskanie tokenu OAuth nie powiodło się, pomijam.', { skipped: true });
  const pending = fetchToken(c).then((t) => { cache = { key: c.email, token: t.token, exp: t.exp, pending: null, failUntil: 0 }; return t.token; },
    (e) => {
      console.error(`FCM: błąd tokenu OAuth (${e?.message || e?.name || 'nieznany'}); pomijam wysyłkę na ${FAIL_MS / 1000} s.`);
      if (cache.pending === pending) cache = { key: c.email, token: null, exp: 0, pending: null, failUntil: Date.now() + FAIL_MS };
      throw Object.assign(e, { transient: true });
    });
  cache = { key: c.email, token: null, exp: 0, pending, failUntil: 0 };
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

// Czy odpowiedź mówi, że sam token urządzenia jest nieważny (INVALID_ARGUMENT tylko, gdy błąd dotyczy message.token)
function badToken(status, codes, j) {
  if (status === 404 || codes.includes('UNREGISTERED') || codes.includes('SENDER_ID_MISMATCH')) return true;
  if (!codes.includes('INVALID_ARGUMENT') && status !== 400) return false;
  return (j?.error?.details || []).some((d) => (d?.fieldViolations || []).some((v) => /(^|\.)message\.token$/.test(String(v?.field || ''))));
}

// Wysyła do jednego tokenu. Nieważny token rzuca błąd z statusCode 404 (deliver() go usuwa, jak 410 w Web Push);
// błędy konfiguracji i usługi (OAuth, 401 po ponowieniu, 403, 429, 5xx, timeout) mają transient = true i nie liczą się jako porażka tokenu.
export async function sendFcm(token, payload) {
  const c = fcmConfig();
  if (!c) return false;
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(c.projectId)}/messages:send`;
  const body = JSON.stringify({ message: buildMessage(token, payload) });
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    const bearer = await accessToken(c); // błędy OAuth są już oznaczone jako transient
    try {
      res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(TIMEOUT) });
    } catch (e) { console.error(`FCM: błąd połączenia (${e?.name || 'nieznany'}).`); throw transient(`FCM: błąd połączenia (${e?.name || 'nieznany'}).`); }
    if (res.status !== 401 || attempt) break;
    if (cache.token === bearer) cache = { ...cache, token: null, exp: 0 }; // unieważniamy tylko ten token (pending innych zostaje)
  }
  if (res.ok) return true;
  const j = await res.json().catch(() => ({}));
  const codes = [j?.error?.status, ...(j?.error?.details || []).map((d) => d?.errorCode)].filter(Boolean);
  const label = `FCM ${res.status} ${codes.join(' ')}`.trim();
  if (badToken(res.status, codes, j)) throw Object.assign(new Error(label), { statusCode: 404 });
  console.error(label);
  throw Object.assign(new Error(label), { statusCode: res.status, transient: [401, 403, 429].includes(res.status) || res.status >= 500 });
}
