import { widgetClear } from '../app/components/native/bridge.js';

// POM-25: blokada PIN-em w przeglądarce/PWA i wylogowanie po bezczynności. Wszystko lokalne, serwer nie wie nic o PIN-ie.
// PIN trafia do localStorage wyłącznie jako skrót PBKDF2-SHA256 z solą. To bramka przed przypadkowym wglądem
// (wspólny komputer, telefon w cudzych rękach), a nie szyfrowanie: kto ma dostęp do narzędzi przeglądarki, ominie ją.
export const LOCK_KEY = 'zielnik.applock';        // { v, salt, hash, iter, mins, cred }
export const FAIL_KEY = 'zielnik.applock.fail';   // { n, until }
export const IDLE_KEY = 'zielnik.autoLogout';     // godziny: 0 (wyłączone) | 1 | 8 | 24
export const ACTIVE_KEY = 'zielnik.lastActive';   // ms, wspólne dla kart
export const UNLOCKED_KEY = 'zielnik.unlocked.web'; // sessionStorage
export const SEEN_KEY = 'zielnik.seenAt';         // sessionStorage: kiedy karta była ostatnio widoczna
export const LOCK_EVENT = 'zielnik:applock';
const USER_KEY = 'zielnik.lockUser';         // kto ostatnio logował się na tym urządzeniu

// Po poprawnym zalogowaniu hasłem: hasło zastępuje PIN w tej karcie, a zegar bezczynności startuje od nowa
// (stary znacznik sprzed wylogowania wyrzuciłby użytkownika zaraz po zalogowaniu).
// Blokada należy do urządzenia: gdy loguje się inna osoba, PIN poprzedniej przestaje obowiązywać.
export function markFreshLogin(username) {
  const now = String(Date.now());
  try {
    const who = String(username || '').toLowerCase();
    const prev = localStorage.getItem(USER_KEY);
    if (who && prev && prev !== who) { removeLock(); widgetClear(); } // inne konto: widżet nie zostaje z liczbą poprzedniego
    if (who) localStorage.setItem(USER_KEY, who);
  } catch { /* jw. */ }
  try { sessionStorage.setItem(UNLOCKED_KEY, '1'); sessionStorage.setItem(SEEN_KEY, now); } catch { /* prywatny tryb */ }
  try { localStorage.setItem(ACTIVE_KEY, now); } catch { /* jw. */ }
}
export const MINUTES = [1, 5, 15];
export const IDLE_HOURS = [0, 1, 8, 24];
export const MAX_FAILS = 10;
export const PBKDF2_ITER = 310000;
export const PUBLIC_PATHS = ['/login', '/register', '/prywatnosc', '/odzyskaj-haslo', '/nowe-haslo', '/potwierdz-email'];

export const validPin = (p) => typeof p === 'string' && /^\d{4,8}$/.test(p);
export const isPublicPath = (p) => PUBLIC_PATHS.includes(p);

const b64 = (buf) => { let s = ''; for (const b of new Uint8Array(buf)) s += String.fromCharCode(b); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

export async function hashPin(pin, salt, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations: iter }, key, 256);
  return b64(bits);
}

export async function makeRecord(pin, mins = 5) {
  const salt = newSalt();
  return { v: 1, salt, hash: await hashPin(pin, salt), iter: PBKDF2_ITER, mins: MINUTES.includes(mins) ? mins : 5, cred: null };
}

export async function verifyPin(pin, rec) {
  if (!rec?.hash || !validPin(pin)) return false;
  const h = await hashPin(pin, rec.salt, rec.iter || PBKDF2_ITER);
  let d = h.length ^ rec.hash.length;
  for (let i = 0; i < h.length; i++) d |= h.charCodeAt(i) ^ (rec.hash.charCodeAt(i) || 0);
  return d === 0;
}

// Opóźnienie po n-tym błędzie z rzędu (ms). Od MAX_FAILS: wylogowanie.
export function delayAfter(n) {
  if (n < 3) return 0;
  return [5, 15, 30, 60, 120, 300, 600][Math.min(n, 9) - 3] * 1000;
}

const read = (store, key) => { try { return JSON.parse(store.getItem(key)); } catch { return null; } };
const write = (store, key, v) => { try { store.setItem(key, JSON.stringify(v)); } catch { /* zablokowane dane witryny */ } };

export const loadLock = (store = globalThis.localStorage) => {
  const r = read(store, LOCK_KEY);
  return r && typeof r.hash === 'string' && typeof r.salt === 'string' ? r : null;
};
export const saveLock = (rec, store = globalThis.localStorage) => write(store, LOCK_KEY, rec);
export function removeLock(store = globalThis.localStorage) {
  try { store.removeItem(LOCK_KEY); store.removeItem(FAIL_KEY); } catch { /* jw. */ }
}

export function failState(store = globalThis.localStorage, now = Date.now()) {
  const f = read(store, FAIL_KEY) || {};
  const n = Number.isInteger(f.n) && f.n > 0 ? f.n : 0;
  return { n, wait: Math.max(0, (Number(f.until) || 0) - now), logout: n >= MAX_FAILS };
}
export function recordFail(store = globalThis.localStorage, now = Date.now()) {
  const n = failState(store, now).n + 1;
  write(store, FAIL_KEY, { n, until: now + delayAfter(n) });
  return failState(store, now);
}
export const clearFails = (store = globalThis.localStorage) => { try { store.removeItem(FAIL_KEY); } catch { /* jw. */ } };

// Czy po nieobecności (ms od ukrycia karty) trzeba zablokować
export const awayLocks = (hiddenAt, now, mins) => Boolean(hiddenAt) && now - hiddenAt >= (MINUTES.includes(mins) ? mins : 5) * 60000;
// Czy minął limit bezczynności (hours 0 = wyłączone; brak znacznika = nie wylogowujemy)
export const idleExpired = (lastActive, now, hours) => hours > 0 && Boolean(lastActive) && now - lastActive >= hours * 3600000;

export const loadIdleHours = (store = globalThis.localStorage) => {
  try { const h = Number(store.getItem(IDLE_KEY)); return IDLE_HOURS.includes(h) ? h : 0; } catch { return 0; }
};
export const saveIdleHours = (h, store = globalThis.localStorage) => { try { store.setItem(IDLE_KEY, String(h)); } catch { /* jw. */ } };

// Skrypt w <head>: zasłania treść zanim React się załaduje (bez mignięcia danych). Ta sama reguła co w WebLock.
export const BOOT_SCRIPT = "(function(){try{var d=document.documentElement;if(d.classList.contains('native-app'))return;if(" + JSON.stringify(PUBLIC_PATHS).replace(/"/g, "'") + ".indexOf(location.pathname)>=0)return;var r=JSON.parse(localStorage.getItem('zielnik.applock')||'null');if(!r||!r.hash)return;var s=sessionStorage,seen=+s.getItem('zielnik.seenAt')||0;if(s.getItem('zielnik.unlocked.web')==='1'&&(!seen||Date.now()-seen<(r.mins||5)*60000))return;d.dataset.applock='locked'}catch(e){}})()";

// WebAuthn jako szybkie odblokowanie: tylko lokalne potwierdzenie obecności użytkownika (odcisk, twarz, PIN urządzenia).
// Bez serwera: nie weryfikujemy podpisu, więc to wygoda, nie dowód tożsamości.
export const webauthnSupported = async () => {
  try { return Boolean(globalThis.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; }
};
const rnd = (n) => crypto.getRandomValues(new Uint8Array(n));
export async function registerPlatformKey(name = 'Zielnik') {
  const c = await navigator.credentials.create({ publicKey: {
    challenge: rnd(32), rp: { name: 'Zielnik' }, user: { id: rnd(16), name, displayName: name },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
    timeout: 60000, attestation: 'none' } });
  if (!c) throw new Error('Nie udało się zarejestrować.');
  return b64(c.rawId);
}
export async function askPlatformKey(cred) {
  const r = await navigator.credentials.get({ publicKey: {
    challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64(cred), transports: ['internal'] }],
    userVerification: 'required', timeout: 60000 } });
  return Boolean(r);
}
