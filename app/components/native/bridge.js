// Dostęp do wtyczek natywnej powłoki (mobile/, Capacitor). Powłoka ładuje tę stronę z serwera i wstrzykuje
// window.Capacitor z metodami wtyczek, więc paczki @capacitor/* nie trafiają do bundla aplikacji webowej.
// W zwykłej przeglądarce wszystkie funkcje zwracają „brak” i nic nie robią.

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent || '');

export function isNative() {
  return typeof window !== 'undefined' && /\bZielnikApp\//.test(ua()) && window.Capacitor?.isNativePlatform?.() === true;
}

// Build z Firebase (google-services.json): bez niego rejestracja push wywróciłaby aplikację na Androidzie
export const hasFcm = () => isNative() && /\bZielnikPush\/fcm\b/.test(ua());

export const plugin = (name) => (isNative() ? window.Capacitor.Plugins?.[name] ?? null : null);

// Uchwyt słuchacza bywa obiektem albo obietnicą; zwraca funkcję sprzątającą
export function listen(pluginName, event, fn) {
  const h = plugin(pluginName)?.addListener?.(event, fn);
  return () => { Promise.resolve(h).then((x) => x?.remove?.()).catch(() => {}); };
}

// --- blokada aplikacji (biometria lub PIN/wzór/hasło telefonu) ---
const LOCK_KEY = 'zielnik.lock';
export const LOCK_EVENT = 'zielnik:lock';

export async function lockEnabled() {
  const P = plugin('Preferences');
  if (!P) return false;
  try { return (await P.get({ key: LOCK_KEY }))?.value === 'on'; } catch { return false; }
}

export async function setLockEnabled(on) {
  await plugin('Preferences').set({ key: LOCK_KEY, value: on ? 'on' : 'off' });
  window.dispatchEvent(new CustomEvent(LOCK_EVENT, { detail: on }));
}

// { available, secure }: czy jest biometria i czy telefon ma w ogóle blokadę ekranu
export async function lockSupport() {
  const B = plugin('BiometricAuthNative');
  if (!B) return { available: false, secure: false };
  const info = await B.checkBiometry();
  return { available: Boolean(info.isAvailable), secure: Boolean(info.deviceIsSecure) };
}

export const NO_SECURITY = 'noSecurity';

// Pokazuje systemowe okno biometrii z możliwością użycia PIN-u telefonu. Rzuca błąd z .code (np. 'userCancel').
export async function authenticate(reason = 'Odblokuj Zielnik') {
  const B = plugin('BiometricAuthNative');
  if (!B) throw Object.assign(new Error('Ta wersja aplikacji nie obsługuje blokady.'), { code: NO_SECURITY });
  const s = await lockSupport();
  if (!s.available && !s.secure) {
    throw Object.assign(new Error('Telefon nie ma ustawionej blokady ekranu ani biometrii.'), { code: NO_SECURITY });
  }
  await B.internalAuthenticate({
    reason, androidTitle: 'Zielnik', androidSubtitle: reason, cancelTitle: 'Anuluj',
    allowDeviceCredential: true, androidConfirmationRequired: false,
  });
}

// --- push FCM (kontrakt: mobile/README.md) ---
const FCM_KEY = 'zielnik.fcmToken';

// Rejestruje urządzenie w FCM i zwraca token (albo rzuca błąd)
export function fcmToken() {
  const P = plugin('PushNotifications');
  return new Promise((resolve, reject) => {
    const offs = [];
    const done = (fn, v) => { offs.forEach((off) => off()); clearTimeout(t); fn(v); };
    const t = setTimeout(() => done(reject, new Error('Brak odpowiedzi usługi powiadomień. Spróbuj ponownie.')), 15000);
    offs.push(listen('PushNotifications', 'registration', ({ value }) => done(resolve, value)));
    offs.push(listen('PushNotifications', 'registrationError', (e) => done(reject, new Error(e?.error || 'Rejestracja powiadomień nie powiodła się.'))));
    P.register().catch((e) => done(reject, e));
  });
}

export async function pushPermission() {
  const P = plugin('PushNotifications');
  return P ? (await P.checkPermissions()).receive : 'denied';
}

export async function requestPushPermission() {
  return (await plugin('PushNotifications').requestPermissions()).receive;
}

export async function saveFcm(token, claim) {
  const r = await fetch('/api/push/subscription', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fcm', token, claim }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Nie udało się zapisać urządzenia.');
  try { localStorage.setItem(FCM_KEY, token); } catch {}
  return d;
}

export async function removeFcm() {
  let token = null;
  try { token = localStorage.getItem(FCM_KEY); localStorage.removeItem(FCM_KEY); } catch {}
  await plugin('PushNotifications')?.unregister?.().catch(() => {});
  if (token) await fetch('/api/push/subscription', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'fcm', token }),
  });
}

export const storedFcm = () => { try { return localStorage.getItem(FCM_KEY); } catch { return null; } };
