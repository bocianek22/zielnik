'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearQueue } from '@/lib/offline-client';
import { widgetClear } from './native/bridge';
import useFocusTrap from './useFocusTrap';

// Ekran ponownej akceptacji: pokazuje go Header, gdy wersja zgody konta (users.consent_version) różni się od LEGAL_VERSION
// (także NULL: konta sprzed wersjonowania). Blokuje korzystanie z aplikacji do akceptacji; alternatywą jest pobranie danych
// albo usunięcie konta. To blokada interfejsu (zgoda jest wymagana, ale dane własne i tak można pobrać), nie ochrona API.
export default function ConsentGate({ version, admin }) {
  const router = useRouter();
  const box = useRef(null);
  const [terms, setTerms] = useState(false);
  const [health, setHealth] = useState(false);
  const [del, setDel] = useState(false);
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useFocusTrap(box, true);

  // reszta strony pod ekranem jest nieaktywna dla klawiatury i czytnika ekranu
  useEffect(() => {
    const root = box.current;
    const marked = [];
    for (let el = root; el && el !== document.body; el = el.parentElement) {
      for (const sib of el.parentElement.children) {
        if (sib !== el && !sib.hasAttribute('inert') && sib.tagName !== 'SCRIPT') { sib.setAttribute('inert', ''); marked.push(sib); }
      }
    }
    return () => marked.forEach((n) => n.removeAttribute('inert'));
  }, []);

  async function accept(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await api('/api/account/consent', 'POST', { consent: terms, healthConsent: health, version });
      // pełne przeładowanie zamiast router.refresh(): pewniej odświeża wszystkie strony i pamięć podręczną routera
      location.reload();
    }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  async function remove() {
    if (!confirm('Trwale usunąć konto i wszystkie Twoje dane? Tego nie da się cofnąć.')) return;
    setErr(''); setBusy(true);
    try { await api('/api/account', 'DELETE', { password: pw }); await clearQueue(); widgetClear(); router.replace('/login'); router.refresh(); }
    catch (x) { setErr(x.message); setBusy(false); }
  }

  return (
    <div className="consent-gate" ref={box} role="dialog" aria-modal="true" aria-labelledby="consent-h">
      <form className="consent-box" onSubmit={accept}>
        <h2 id="consent-h">Zanim przejdziesz dalej</h2>
        <p>Zaktualizowaliśmy regulamin i politykę prywatności. Przeczytaj je i potwierdź, żeby korzystać z aplikacji.</p>
        <ul className="consent-links">
          <li><a href="/regulamin" target="_blank" rel="noopener noreferrer">Regulamin (nowa karta)</a></li>
          <li><a href="/prywatnosc" target="_blank" rel="noopener noreferrer">Polityka prywatności (nowa karta)</a></li>
        </ul>
        <label className="check"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
          <span>Akceptuję regulamin i politykę prywatności</span></label>
        <label className="check"><input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} />
          <span>Wyrażam wyraźną zgodę na przetwarzanie danych o moim zdrowiu (art. 9 ust. 2 lit. a RODO). Mogę ją cofnąć, usuwając konto.</span></label>
        {err && <div className="alert error" role="alert">{err}</div>}
        <button type="submit" className="btn" disabled={busy || !terms || !health}>{busy ? 'Zapisuję…' : 'Akceptuję i przechodzę dalej'}</button>
        <div className="consent-alt">
          <p>Nie chcesz zaakceptować? Możesz pobrać swoje dane{admin ? '' : ' albo usunąć konto'}.</p>
          <a className="btn ghost" href="/api/account/export" download>Pobierz moje dane</a>
          {!admin && !del && <button type="button" className="btn ghost" onClick={() => setDel(true)}>Usuń konto</button>}
          {!admin && del && (
            <div className="field">
              <label htmlFor="consent-pw">Hasło, aby potwierdzić usunięcie</label>
              <input id="consent-pw" className="input" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
              <button type="button" className="btn danger" onClick={remove} disabled={busy || !pw}>Usuń konto i dane</button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
