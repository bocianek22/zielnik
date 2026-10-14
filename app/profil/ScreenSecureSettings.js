'use client';
import { useEffect, useState } from 'react';
import SecHead from '../components/SecHead';
import { plugin } from '../components/native/bridge';

// POM-59: ochrona ekranu w APK (FLAG_SECURE): bez zrzutów i nagrań ekranu, pusty podgląd w przełączniku aplikacji.
// Widoczna tylko w APK z wtyczką ZielnikScreen (od 0.7.0); ustawienie w pamięci telefonu, domyślnie wyłączone.
export default function ScreenSecureSettings() {
  const [on, setOn] = useState(null); // null = brak wtyczki albo sprawdzanie
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const P = plugin('ZielnikScreen');
    if (!P?.get) return;
    P.get().then((r) => setOn(!!r?.secure)).catch(() => {});
  }, []);

  if (on === null) return null;

  async function toggle(e) {
    const next = e.target.checked;
    setBusy(true); setMsg('');
    try {
      const r = await plugin('ZielnikScreen').set({ secure: next });
      setOn(!!r?.secure);
      setMsg(next ? 'Włączono. Zrzuty ekranu są zablokowane, a podgląd w przełączniku aplikacji jest pusty.' : 'Wyłączono.');
    } catch (err) { setMsg(err?.message || 'Nie udało się zmienić ustawienia.'); }
    setBusy(false);
  }

  return (
    <section className="card stack" aria-labelledby="screen-h">
      <SecHead icon="shield" id="screen-h">Ochrona ekranu</SecHead>
      <p className="muted">Blokuje zrzuty i nagrywanie ekranu oraz ukrywa treść w podglądzie ostatnich aplikacji. Nie obejmuje systemowych okien druku i udostępniania. Jeśli robisz zrzuty dla lekarza, zostaw wyłączone (raport wydrukujesz albo zapiszesz jako PDF).</p>
      <label className="switch-row native-check">
        <span>Blokuj zrzuty ekranu i podgląd w przełączniku</span>
        <input type="checkbox" className="switch" role="switch" checked={on} disabled={busy} onChange={toggle} />
      </label>
      <span role="status" className="muted">{msg}</span>
    </section>
  );
}
