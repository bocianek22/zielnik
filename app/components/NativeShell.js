'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LOCK_EVENT, NO_SECURITY, authenticate, fcmToken, hasFcm, isNative, listen, lockEnabled, plugin, pushPermission, saveFcm, setLockEnabled, storedFcm } from './native/bridge';
import { installHaptics, installKeyboard, isPageLink, transition } from './native/behaviors';
import PullRefresh from './native/PullRefresh';
import useFocusTrap from './useFocusTrap';

// Po tylu milisekundach w tle aplikacja z włączoną blokadą prosi o odblokowanie (krótsze wyjścia, np. wybór zdjęcia
// albo link w przeglądarce, nie wymagają ponownej biometrii)
const AWAY_MS = 30000;
const UNLOCKED = 'zielnik.unlocked'; // sessionStorage: przeładowanie strony w tej samej sesji aplikacji nie blokuje ponownie

const noop = () => () => {};
const onlineEvents = (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); }; };

const markUnlocked = (v) => { try { v ? sessionStorage.setItem(UNLOCKED, '1') : sessionStorage.removeItem(UNLOCKED); } catch {} };
const wasUnlocked = () => { try { return sessionStorage.getItem(UNLOCKED) === '1'; } catch { return false; } };

// Integracja z natywną powłoką (mobile/): przycisk wstecz, linki zewnętrzne, pasek stanu, blokada, odświeżenie tokenu push.
// W przeglądarce nic nie renderuje i nic nie robi.
export default function NativeShell() {
  const [lock, setLock] = useState(null); // null | 'cover' (zasłona w tle) | 'locked'
  const [msg, setMsg] = useState('');
  // brak sieci: dyskretny pasek (pełna strona błędu jest tylko przy ładowaniu strony, patrz mobile/www/error.html)
  const native = useSyncExternalStore(noop, isNative, () => false);
  const offline = useSyncExternalStore(onlineEvents, () => navigator.onLine === false, () => false);
  const lockOn = useRef(false);
  const authing = useRef(false);
  const authEnd = useRef(0);
  const bgAt = useRef(0);

  async function unlock() {
    if (authing.current) return;
    authing.current = true; setMsg('');
    try {
      await authenticate('Odblokuj Zielnik');
      markUnlocked(true); setLock(null);
    } catch (e) {
      if (e?.code === NO_SECURITY) {
        // telefon nie ma już żadnej blokady: nie zamykamy użytkownika na zawsze, tylko wyłączamy funkcję
        await setLockEnabled(false).catch(() => {});
        markUnlocked(true); setLock(null);
      } else if (e?.code !== 'userCancel' && e?.code !== 'appCancel' && e?.code !== 'systemCancel') {
        setMsg(e?.message || 'Nie udało się odblokować.');
      }
    } finally {
      authing.current = false; authEnd.current = Date.now();
    }
  }

  useEffect(() => {
    if (!isNative()) return;
    document.documentElement.classList.add('native-app');
    plugin('StatusBar')?.setStyle?.({ style: 'DARK' }).catch(() => {}); // jasne ikony na zielonym pasku (--hemp-deep)
    const offs = [installHaptics(), installKeyboard()];

    // Wstecz: historia strony, a na pierwszej stronie zejście do tła (jak w innych aplikacjach)
    offs.push(listen('App', 'backButton', ({ canGoBack }) => {
      if (canGoBack) { transition(true); window.history.back(); }
      else plugin('App').minimizeApp().catch(() => plugin('App').exitApp());
    }));

    // Linki do innych serwisów otwieramy w przeglądarce systemowej, nie w oknie aplikacji
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target.closest?.('a[href]');
      if (!a) return;
      let u;
      try { u = new URL(a.href, window.location.href); } catch { return; }
      if (!/^https?:$/.test(u.protocol) || u.origin === window.location.origin) return;
      e.preventDefault();
      plugin('Browser')?.open({ url: u.href, toolbarColor: '#1d3b27' }).catch(() => { window.location.href = u.href; });
    };
    document.addEventListener('click', onClick, true);
    offs.push(() => document.removeEventListener('click', onClick, true));

    // Płynne przejście przy wejściu na inną stronę aplikacji (nawigację wykonuje Next, my tylko animujemy)
    // sprawdzenie defaultPrevented w isPageLink: inne obsługi w fazie capture (np. odsłanianie w trybie dyskretnym) mogą anulować kliknięcie
    const onNav = (e) => { if (isPageLink(e)) transition(); };
    document.addEventListener('click', onNav, true);
    offs.push(() => document.removeEventListener('click', onNav, true));

    // Blokada przy starcie i po powrocie z tła
    const onLockChange = (e) => { lockOn.current = Boolean(e.detail); if (lockOn.current) markUnlocked(true); };
    window.addEventListener(LOCK_EVENT, onLockChange);
    offs.push(() => window.removeEventListener(LOCK_EVENT, onLockChange));
    lockEnabled().then((on) => {
      lockOn.current = on;
      if (on && !wasUnlocked()) { setLock('locked'); unlock(); }
      // ekran startowy znika dopiero teraz, żeby przy włączonej blokadzie nie mignęła treść (najpóźniej po launchShowDuration)
      setTimeout(() => plugin('SplashScreen')?.hide?.().catch(() => {}), 50);
    });
    offs.push(listen('App', 'appStateChange', ({ isActive }) => {
      // okno biometrii samo przenosi aplikację w tło i z powrotem
      if (!lockOn.current || authing.current || Date.now() - authEnd.current < 1500) return;
      if (!isActive) {
        bgAt.current = Date.now();
        setLock((l) => l || 'cover'); // zasłona na podglądzie ostatnich aplikacji (na ile zdąży się narysować)
      } else if (Date.now() - bgAt.current >= AWAY_MS) {
        markUnlocked(false); setLock('locked'); unlock();
      } else {
        setLock((l) => (l === 'cover' ? null : l));
      }
    }));

    // Push: stuknięcie w powiadomienie otwiera wskazaną stronę; token odświeżamy raz dziennie (bez przejmowania urządzenia)
    if (hasFcm()) {
      offs.push(listen('PushNotifications', 'pushNotificationActionPerformed', ({ notification }) => {
        const url = notification?.data?.url;
        if (typeof url === 'string' && url.startsWith('/')) window.location.href = url;
      }));
      (async () => {
        const today = new Date().toISOString().slice(0, 10);
        try { if (localStorage.getItem('zielnik.fcmSync') === today) return; } catch {}
        if (!storedFcm() || (await pushPermission()) !== 'granted') return;
        await saveFcm(await fcmToken(), false);
        try { localStorage.setItem('zielnik.fcmSync', today); } catch {}
      })().catch(() => {});
    }

    return () => offs.forEach((off) => off());
  }, []);

  if (!native) return null;
  return (
    <>
      <PullRefresh />
      {offline && <div className="native-offline" role="status">Brak połączenia</div>}
      {lock && <LockScreen lock={lock} msg={msg} unlock={unlock} />}
    </>
  );
}

function LockScreen({ lock, msg, unlock }) {
  const box = useRef(null);
  useFocusTrap(box, true);
  return (
    <div className="native-lock" ref={box} role="dialog" aria-modal="true" aria-labelledby="native-lock-h">
      <div className="native-lock-in">
        <h2 id="native-lock-h">Zielnik jest zablokowany</h2>
        {lock === 'locked' && (
          <>
            <p>Odblokuj odciskiem palca, twarzą albo kodem telefonu.</p>
            <button type="button" className="btn" onClick={unlock}>Odblokuj</button>
            {msg && <p role="alert">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
}
