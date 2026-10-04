'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { clearQueue, flushQueue, queueState } from '@/lib/offline-client';
import { isDiscreet } from '@/lib/discreet';
import {
  ACTIVE_KEY, LOCK_EVENT, SEEN_KEY, UNLOCKED_KEY, askPlatformKey, awayLocks, clearFails, failState, idleExpired,
  isPublicPath, loadIdleHours, loadLock, recordFail, removeLock, verifyPin,
} from '@/lib/applock';
import { clearDeviceData } from './deviceData';
import { dropPush } from './LogoutButton';
import { isNative, storedFcm } from './native/bridge';

const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* jw. */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* jw. */ } },
};
const setCover = (v) => { if (v) document.documentElement.dataset.applock = v; else delete document.documentElement.dataset.applock; };

// Wylogowanie bez pytań (bezczynność, 10 błędnych PIN-ów). `keepData`: przy bezczynności nie kasujemy niewysłanej kolejki
// offline (to dane użytkownika), więc wylogowanie czeka na sieć. Zwraca true, gdy sesja została zakończona.
export async function forceLogout({ keepData = false } = {}) {
  try {
    if (queueState().pending > 0) {
      await flushQueue().catch(() => {});
      if (keepData && queueState().pending > 0) return false;
    }
    await clearQueue();
    const pushEndpoint = await dropPush();
    const fcmToken = storedFcm() || undefined;
    await api('/api/auth/logout', 'POST', pushEndpoint || fcmToken ? { pushEndpoint, fcmToken } : undefined);
  } catch { return false; } // ciasteczko sesji kasuje tylko serwer: bez niego nie udajemy wylogowania
  clearDeviceData();
  window.location.replace('/login');
  return true;
}

// Blokada PIN-em/odciskiem w przeglądarce (POM-25) i wylogowanie po bezczynności. W aplikacji natywnej blokadę
// zostawiamy powłoce (NativeShell); wylogowanie po bezczynności działa wszędzie.
export default function WebLock() {
  const path = usePathname();
  const [locked, setLocked] = useState(false);
  const pub = isPublicPath(path);

  const unlocked = useCallback(() => {
    ss.set(UNLOCKED_KEY, '1'); ss.set(SEEN_KEY, String(Date.now()));
    setCover(null); setLocked(false);
  }, []);

  // blokada: start, ukrycie i powrót do karty, zmiana ustawień
  useEffect(() => {
    if (isNative() || pub) {
      setCover(null); setLocked(false);
      if (pub) unlocked(); // po zalogowaniu hasłem nie pytamy od razu o PIN
      return undefined;
    }
    const evaluate = () => {
      const rec = loadLock();
      if (!rec) { setCover(null); setLocked(false); return; }
      const seen = Number(ss.get(SEEN_KEY)) || 0;
      if (ss.get(UNLOCKED_KEY) === '1' && !awayLocks(seen, Date.now(), rec.mins)) { setCover(null); setLocked(false); return; }
      ss.del(UNLOCKED_KEY); setCover('locked'); setLocked(true);
    };
    const onVis = () => {
      if (!loadLock()) return;
      if (document.visibilityState === 'hidden') {
        // zasłona od razu, żeby podgląd karty/przełącznik aplikacji nie pokazywał danych
        if (ss.get(UNLOCKED_KEY) === '1') ss.set(SEEN_KEY, String(Date.now()));
        setCover('cover');
      } else evaluate();
    };
    const onHide = () => { if (loadLock()) setCover('cover'); };
    evaluate();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener(LOCK_EVENT, evaluate);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener(LOCK_EVENT, evaluate);
    };
  }, [pub, unlocked]);

  // wylogowanie po bezczynności
  useEffect(() => {
    if (pub) return undefined;
    let lastWrite = 0;
    const touch = () => {
      const now = Date.now();
      if (now - lastWrite < 15000) return;
      lastWrite = now;
      try { localStorage.setItem(ACTIVE_KEY, String(now)); } catch { /* jw. */ }
    };
    const check = () => {
      const hours = loadIdleHours();
      let last = 0;
      try { last = Number(localStorage.getItem(ACTIVE_KEY)) || 0; } catch { /* jw. */ }
      if (!last) { touch(); return; }
      if (idleExpired(last, Date.now(), hours)) forceLogout({ keepData: true });
    };
    check(); touch();
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, touch, { capture: true, passive: true }));
    const t = setInterval(check, 60000);
    const onVis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener(LOCK_EVENT, check);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener(LOCK_EVENT, check);
    };
  }, [pub]);

  return locked ? <LockScreen onUnlock={unlocked} /> : null;
}

function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState(() => failState());
  const [rec] = useState(() => loadLock());
  const [discreet] = useState(() => isDiscreet());
  const input = useRef(null);
  const name = discreet ? 'Notatnik' : 'Zielnik';

  // odliczanie opóźnienia po błędnych próbach
  useEffect(() => {
    if (fail.wait <= 0) return undefined;
    const t = setTimeout(() => setFail(failState()), Math.min(fail.wait, 1000));
    return () => clearTimeout(t);
  }, [fail]);

  const logout = useCallback(async () => {
    setBusy(true); setMsg('');
    if (await forceLogout()) removeLock(); // hasło przy ponownym logowaniu zastępuje PIN, więc zapomniany PIN nie blokuje na zawsze
    else setMsg('Nie udało się wylogować (brak połączenia?). Spróbuj ponownie.');
    setBusy(false);
  }, []);

  const quick = useCallback(async () => {
    if (!rec?.cred) return;
    try { if (await askPlatformKey(rec.cred)) { clearFails(); onUnlock(); } } catch { /* anulowano albo brak gestu: zostaje PIN */ }
  }, [rec, onUnlock]);

  // pierwsza próba odcisku od razu (przeglądarki wymagające gestu po prostu odmówią)
  useEffect(() => { if (rec?.cred && failState().wait <= 0) quick(); }, [rec, quick]);
  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => { if (fail.logout) logout(); }, [fail.logout, logout]);

  async function submit(e) {
    e.preventDefault();
    if (busy || fail.wait > 0 || fail.logout) return;
    setBusy(true); setMsg('');
    if (await verifyPin(pin, rec)) { clearFails(); onUnlock(); return; }
    const f = recordFail();
    setFail(f); setPin(''); setBusy(false);
    setMsg(f.logout ? 'Zbyt wiele błędnych prób. Wylogowuję…' : 'Niepoprawny PIN.');
    input.current?.focus();
  }

  const secs = Math.ceil(fail.wait / 1000);
  const left = 10 - fail.n;
  return (
    <div className="web-lock" role="dialog" aria-modal="true" aria-labelledby="web-lock-h">
      <form className="web-lock-in" onSubmit={submit}>
        <h2 id="web-lock-h">{name} jest zablokowany</h2>
        <p>Podaj PIN{rec?.cred ? ' albo użyj odcisku palca lub twarzy' : ''}.</p>
        <input ref={input} className="input web-lock-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={8}
          value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} aria-label="PIN" disabled={busy || fail.wait > 0 || fail.logout} />
        <button type="submit" className="btn" disabled={busy || fail.wait > 0 || fail.logout || pin.length < 4}>Odblokuj</button>
        {rec?.cred && <button type="button" className="btn ghost" onClick={quick} disabled={busy}>Odcisk palca lub twarz</button>}
        {fail.wait > 0 && !fail.logout && <p role="alert">Zbyt wiele prób. Spróbuj za {secs} s.</p>}
        {msg && <p role="alert">{msg}{fail.n >= 5 && !fail.logout ? ` Zostało prób: ${left}, potem nastąpi wylogowanie.` : ''}</p>}
        <button type="button" className="btn text" onClick={logout} disabled={busy}>Nie pamiętam PIN-u, wyloguj</button>
      </form>
    </div>
  );
}
