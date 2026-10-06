'use client';
import { useEffect, useState } from 'react';
import { forceLogout } from '../components/WebLock';
import { isNative } from '../components/native/bridge';
import {
  IDLE_HOURS, LOCK_EVENT, MINUTES, clearFails, failState, loadIdleHours, loadLock, makeRecord, recordFail,
  registerPlatformKey, removeLock, saveIdleHours, saveLock, validPin, verifyPin, webauthnSupported,
} from '@/lib/applock';

const idleLabel = (h) => (h === 0 ? 'Wyłączone' : h === 1 ? 'Po 1 godzinie' : `Po ${h} godzinach`);
const notify = () => window.dispatchEvent(new Event(LOCK_EVENT));

// Sekcja „Blokada i bezpieczeństwo”: PIN lokalny (tylko w przeglądarce/PWA; w aplikacji działa blokada natywna powyżej)
// i wylogowanie po bezczynności (wszędzie). Wszystko zapisane na tym urządzeniu, nic nie trafia na serwer.
export default function WebLockSettings() {
  const [ready, setReady] = useState(false);
  const [native, setNative] = useState(false);
  const [rec, setRec] = useState(null);
  const [idle, setIdle] = useState(0);
  const [wa, setWa] = useState(false);
  const [mode, setMode] = useState(null); // null | 'set' | 'off' | 'change'
  const [cur, setCur] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setNative(isNative()); setRec(loadLock()); setIdle(loadIdleHours()); setReady(true);
    webauthnSupported().then(setWa);
  }, []);
  if (!ready) return null;

  const reset = () => { setMode(null); setCur(''); setPin(''); setPin2(''); setErr(''); };
  const flash = (m) => { setMsg(m); setErr(''); };

  async function enable(e) {
    e.preventDefault();
    if (!validPin(pin)) return setErr('PIN ma mieć od 4 do 8 cyfr.');
    if (pin !== pin2) return setErr('PIN-y nie są takie same.');
    setBusy(true);
    const r = await makeRecord(pin, rec?.mins || 5);
    saveLock(r); clearFails(); setRec(r);
    sessionStorage.setItem('zielnik.unlocked.web', '1'); sessionStorage.setItem('zielnik.seenAt', String(Date.now()));
    reset(); setBusy(false); notify();
    flash('Blokada włączona. PIN jest zapisany tylko na tym urządzeniu (jako skrót), serwer go nie zna.');
  }

  async function disable(e) {
    e.preventDefault();
    if (failState().wait > 0) return setErr('Zbyt wiele prób. Spróbuj za chwilę.');
    setBusy(true);
    if (await verifyPin(pin, rec)) {
      removeLock(); setRec(null); reset(); notify(); flash('Blokada wyłączona.');
    } else {
      const f = recordFail(); setPin('');
      if (f.logout) { setErr('Zbyt wiele błędnych prób. Wylogowuję…'); if (await forceLogout()) removeLock(); }
      else setErr(f.wait > 0 ? `Niepoprawny PIN. Spróbuj za ${Math.ceil(f.wait / 1000)} s.` : 'Niepoprawny PIN.');
    }
    setBusy(false);
  }

  function setMins(e) {
    const r = { ...rec, mins: Number(e.target.value) };
    saveLock(r); setRec(r); notify();
  }

  async function toggleWa(e) {
    const on = e.target.checked;
    setErr('');
    try {
      const cred = on ? await registerPlatformKey() : null;
      const r = { ...rec, cred }; saveLock(r); setRec(r);
      flash(on ? 'Szybkie odblokowanie włączone. PIN zostaje na wypadek, gdyby odcisk albo twarz zawiodły.' : 'Szybkie odblokowanie wyłączone.');
    } catch (x) {
      if (x?.name !== 'NotAllowedError') setErr('Nie udało się włączyć odcisku palca lub twarzy na tym urządzeniu.');
    }
  }

  // zmiana PIN-u bez wyłączania blokady: stary PIN liczy się do limitu prób jak przy wyłączaniu
  async function change(e) {
    e.preventDefault();
    if (failState().wait > 0) return setErr('Zbyt wiele prób. Spróbuj za chwilę.');
    if (!validPin(pin)) return setErr('Nowy PIN ma mieć od 4 do 8 cyfr.');
    if (pin !== pin2) return setErr('Nowe PIN-y nie są takie same.');
    setBusy(true);
    if (await verifyPin(cur, rec)) {
      const r = { ...(await makeRecord(pin, rec.mins)), ...(rec.cred ? { cred: rec.cred } : {}) };
      saveLock(r); clearFails(); setRec(r); reset(); notify(); flash('PIN zmieniony.');
    } else {
      const f = recordFail(); setCur('');
      if (f.logout) { setErr('Zbyt wiele błędnych prób. Wylogowuję…'); if (await forceLogout()) removeLock(); }
      else setErr(f.wait > 0 ? `Niepoprawny obecny PIN. Spróbuj za ${Math.ceil(f.wait / 1000)} s.` : 'Niepoprawny obecny PIN.');
    }
    setBusy(false);
  }

  function changeIdle(e) {
    const h = Number(e.target.value);
    saveIdleHours(h); setIdle(h); notify();
    try { localStorage.setItem('zielnik.lastActive', String(Date.now())); } catch { /* zablokowane dane witryny */ }
    flash(h ? 'Zielnik wyloguje Cię na tym urządzeniu po tym czasie bez aktywności.' : 'Automatyczne wylogowanie wyłączone.');
  }

  return (
    <section className="card stack lock-setup" aria-labelledby="weblock-h">
      <h2 id="weblock-h">Blokada i bezpieczeństwo</h2>

      {native ? (
        <p className="muted">W aplikacji na telefonie blokadę zapewnia odcisk palca, twarz albo kod telefonu (ustawienie powyżej). PIN w przeglądarce nie jest tu potrzebny.</p>
      ) : (
        <>
          <label className="switch-row">
            <span>Blokada PIN-em</span>
            <input type="checkbox" className="switch" role="switch" checked={Boolean(rec)} disabled={busy}
              onChange={(e) => { setMsg(''); setErr(''); setPin(''); setPin2(''); setMode(e.target.checked ? 'set' : 'off'); }} aria-describedby="weblock-d" />
          </label>
          <p id="weblock-d" className="muted small">Ekran blokady zasłania treść przy otwarciu i po powrocie do karty. Nie chroni przed kimś, kto ma dostęp do narzędzi przeglądarki.</p>

          {mode === 'set' && !rec && (
            <form onSubmit={enable}>
              <div className="field"><label htmlFor="wl-pin">Nowy PIN (4-8 cyfr)</label>
                <input id="wl-pin" className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field"><label htmlFor="wl-pin2">Powtórz PIN</label>
                <input id="wl-pin2" className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field-row"><button className="btn" disabled={busy}>Włącz blokadę</button><button type="button" className="btn ghost" onClick={reset}>Anuluj</button></div>
            </form>
          )}
          {mode === 'off' && rec && (
            <form onSubmit={disable}>
              <div className="field"><label htmlFor="wl-off">Podaj PIN, aby wyłączyć blokadę</label>
                <input id="wl-off" className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field-row"><button className="btn danger" disabled={busy || pin.length < 4}>Wyłącz blokadę</button><button type="button" className="btn ghost" onClick={reset}>Anuluj</button></div>
            </form>
          )}

          {mode === 'change' && rec && (
            <form onSubmit={change}>
              <div className="field"><label htmlFor="wl-cur">Obecny PIN</label>
                <input id="wl-cur" className="input" type="password" inputMode="numeric" autoComplete="off" maxLength={8} value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field"><label htmlFor="wl-new">Nowy PIN (4-8 cyfr)</label>
                <input id="wl-new" className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field"><label htmlFor="wl-new2">Powtórz nowy PIN</label>
                <input id="wl-new2" className="input" type="password" inputMode="numeric" autoComplete="new-password" maxLength={8} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} /></div>
              <div className="field-row"><button className="btn" disabled={busy || cur.length < 4}>Zmień PIN</button><button type="button" className="btn ghost" onClick={reset}>Anuluj</button></div>
            </form>
          )}

          {rec && !mode && (
            <>
              <button type="button" className="btn ghost small" onClick={() => { setMsg(''); setErr(''); setMode('change'); }}>Zmień PIN</button>
              <div className="field"><label htmlFor="wl-mins">Zablokuj po powrocie do karty po</label>
                <select id="wl-mins" className="input" value={rec.mins} onChange={setMins}>
                  {MINUTES.map((m) => <option key={m} value={m}>{m === 1 ? '1 minucie' : `${m} minutach`}</option>)}
                </select></div>
              {wa && (
                <label className="switch-row">
                  <span>Szybkie odblokowanie odciskiem palca lub twarzą</span>
                  <input type="checkbox" className="switch" role="switch" checked={Boolean(rec.cred)} onChange={toggleWa} />
                </label>
              )}
              <p className="muted small">Po 10 błędnych PIN-ach nastąpi wylogowanie, a od trzeciego błędu rośnie opóźnienie. Zapomniany PIN: na ekranie blokady wybierz wylogowanie i zaloguj się hasłem.</p>
            </>
          )}
        </>
      )}

      <div className="field"><label htmlFor="wl-idle">Wyloguj po bezczynności</label>
        <select id="wl-idle" className="input" value={idle} onChange={changeIdle}>
          {IDLE_HOURS.map((h) => <option key={h} value={h}>{idleLabel(h)}</option>)}
        </select></div>
      <p className="muted small">Dotyczy tego urządzenia. Gdy w kolejce są niewysłane wpisy, wylogowanie poczeka na połączenie, żeby ich nie utracić.</p>

      {err && <p className="alert error" role="alert">{err}</p>}
      <span role="status" className="muted">{msg}</span>
    </section>
  );
}
