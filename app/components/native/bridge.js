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
  widgetLocked(on); // widżet: przy włączonej blokadzie bez liczby
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

// --- haptyka (@capacitor/haptics; system sam respektuje ustawienie wibracji telefonu) ---
// Rodzaje: 'light' (przełącznik, wybór), 'success' (zapis), 'error' (błąd), 'refresh' (odświeżenie)
export function haptic(kind = 'light') {
  const H = plugin('Haptics');
  if (!H) return;
  try {
    const p = kind === 'success' ? H.notification?.({ type: 'SUCCESS' })
      : kind === 'error' ? H.notification?.({ type: 'ERROR' })
      : H.impact?.({ style: kind === 'refresh' ? 'MEDIUM' : 'LIGHT' });
    p?.catch?.(() => {});
  } catch {}
}

// --- druk raportu (wtyczka ZielnikPrint w mobile/android: PrintManager z WebView, okno z „Zapisz jako PDF”) ---
// Zwraca obietnicę, gdy aplikacja ma wtyczkę, albo false (przeglądarka, iOS, starsza wersja APK: wtedy window.print()).
// Bez await przed window.print(), żeby przeglądarka nie potraktowała druku jako wywołanego bez dotknięcia.
export function nativePrint(name) {
  const P = plugin('ZielnikPrint');
  if (!P?.print) return false;
  try { return Promise.resolve(P.print({ name })); } catch (e) { return Promise.reject(e); }
}

// --- udostępnianie PDF (wtyczka ZielnikShare w mobile/android: plik w cache + FileProvider + systemowe okno „Udostępnij”) ---
// Starsze APK nie mają wtyczki: wtedy canNativeSharePdf() zwraca false i zostaje sam druk.
export const canNativeSharePdf = () => typeof plugin('ZielnikShare')?.sharePdf === 'function';

// bytes: Uint8Array z PDF-em. Base64 w kawałkach, żeby nie przekroczyć limitu argumentów String.fromCharCode.
export function bytesToBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function nativeSharePdf(bytes, fileName) {
  const P = plugin('ZielnikShare');
  if (!P?.sharePdf) throw new Error('Ta wersja aplikacji nie umie udostępniać plików PDF.');
  await P.sharePdf({ base64: bytesToBase64(bytes), fileName });
}

// Wersja aplikacji natywnej: { version, build } z App.getInfo() albo null (przeglądarka)
export async function appInfo() {
  const A = plugin('App');
  if (!A?.getInfo) return null;
  try { const i = await A.getInfo(); return { version: i.version, build: i.build }; } catch { return null; }
}

// --- widżet ekranu głównego Androida „Zapas i Zużyłem” (POM-13, docs/WIDZET-ANDROID.md; wtyczka ZielnikWidget) ---
// Bez wtyczki (przeglądarka, iOS, starsze APK) wszystkie trzy funkcje nic nie robią i nie rzucają błędu.
// Do telefonu trafia tylko data końca zapasu i informacja o blokadzie; widżet sam odlicza dni.
const widgetCall = (method, arg) => {
  try { plugin('ZielnikWidget')?.[method]?.(arg)?.catch?.(() => {}); } catch {}
};

// payload: { until: 'RRRR-MM-DD' | null } z widgetPayload (lib/widget.js)
let widgetGen = 0; // każde wyczyszczenie unieważnia zapisy rozpoczęte przed nim (await lockEnabled)

export async function widgetSet(payload) {
  if (!plugin('ZielnikWidget')) return;
  const gen = widgetGen;
  const locked = await lockEnabled();
  if (gen !== widgetGen) return;
  widgetCall('set', { until: payload?.until ?? null, locked });
}

// Sama zmiana blokady (ustawiona w profilu): data zostaje taka, jaka była
export function widgetLocked(locked) {
  widgetCall('set', { locked: Boolean(locked) });
}

// Wylogowanie, zmiana konta, usunięcie konta: widżet nie może zostać z liczbą poprzedniego konta
export function widgetClear() {
  widgetGen++;
  widgetCall('clear');
}
