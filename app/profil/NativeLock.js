'use client';
import SecHead from '../components/SecHead';
import { useEffect, useState } from 'react';
import { NO_SECURITY, authenticate, isNative, lockEnabled, lockSupport, setLockEnabled } from '../components/native/bridge';

// Blokada aplikacji biometrią lub kodem telefonu. Widoczna tylko w aplikacji natywnej (mobile/), ustawienie
// trzymane w pamięci telefonu (Preferences), domyślnie wyłączone.
export default function NativeLock() {
  const [state, setState] = useState(null); // null = nie aplikacja albo sprawdzanie
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!isNative()) return;
    Promise.all([lockEnabled(), lockSupport().catch(() => ({ available: false, secure: false }))])
      .then(([on, s]) => setState({ on, ...s }));
  }, []);

  if (!state) return null;

  async function toggle(e) {
    const on = e.target.checked;
    setBusy(true); setMsg('');
    try {
      // potwierdzenie także przy wyłączaniu, żeby ktoś z odblokowanym telefonem nie zdjął blokady jednym stuknięciem
      await authenticate(on ? 'Potwierdź włączenie blokady' : 'Potwierdź wyłączenie blokady');
      await setLockEnabled(on);
      setState((s) => ({ ...s, on }));
      setMsg(on ? 'Blokada włączona. Zielnik poprosi o odblokowanie przy otwarciu i po powrocie z tła.' : 'Blokada wyłączona.');
    } catch (err) {
      if (err?.code === NO_SECURITY) setMsg('Najpierw ustaw blokadę ekranu (PIN, wzór lub hasło) albo odcisk palca w ustawieniach telefonu.');
      else if (err?.code !== 'userCancel' && err?.code !== 'appCancel') setMsg(err?.message || 'Nie udało się zmienić ustawienia.');
    }
    setBusy(false);
  }

  return (
    <section className="card stack" aria-labelledby="lock-h">
      <SecHead icon="key" id="lock-h">Blokada aplikacji</SecHead>
      <p className="muted">Zielnik poprosi o odcisk palca, twarz albo kod telefonu przy otwarciu i po powrocie z tła (po ponad 30 sekundach).</p>
      {!state.available && !state.secure && <p className="alert note">Telefon nie ma ustawionej blokady ekranu, więc tej funkcji nie da się włączyć.</p>}
      <label className="switch-row native-check">
        <span>Blokuj Zielnik biometrią lub kodem telefonu</span>
        <input type="checkbox" className="switch" role="switch" checked={state.on} disabled={busy || (!state.on && !state.available && !state.secure)} onChange={toggle} />
      </label>
      <span role="status" className="muted">{msg}</span>
    </section>
  );
}
