'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Adres e-mail do odzyskiwania hasła (KON-1). Ukryty, gdy wysyłka nie jest skonfigurowana i adresu nie ma;
// zapisany wcześniej adres można wtedy tylko usunąć.
export default function EmailSettings({ isAdmin }) {
  const [st, setSt] = useState(null);
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [pw, setPw] = useState('');
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/api/account/email').then(setSt, (e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  if (!st || (!st.enabled && !st.email)) return null;

  async function save(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!consent) return setErr('Zaznacz zgodę na zapisanie adresu.');
    setBusy(true);
    try {
      const r = await api('/api/account/email', 'PUT', { email, consent, password: pw });
      setPw(''); setEditing(false);
      setMsg(r.verified ? 'Adres zapisany.' : 'Wysłaliśmy link potwierdzający. Sprawdź skrzynkę (link jest ważny 30 minut).');
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!confirm('Usunąć adres e-mail? Bez niego nie odzyskasz hasła samodzielnie.')) return;
    setErr(''); setMsg('');
    try { await api('/api/account/email', 'DELETE'); setMsg('Adres usunięty.'); setEditing(false); await load(); }
    catch (e2) { setErr(e2.message); }
  }
  const start = () => { setEmail(st.email || ''); setConsent(false); setPw(''); setEditing(true); setMsg(''); setErr(''); };

  return (
    <section className="card" aria-labelledby="email-h">
      <h2 id="email-h">Adres e-mail</h2>
      <p className="muted">Opcjonalny. Służy tylko do odzyskania hasła, gdy je zapomnisz. Nikt poza Tobą go nie widzi; trafia do eksportu Twoich danych i znika razem z kontem.</p>
      {isAdmin && <p className="muted">Konta administratora nie odzyskują hasła e-mailem (ochrona panelu i kopii zapasowych).</p>}
      {st.email && !editing && (
        <div className="list inset">
          <div className="list-row">
            <span className="lr-main">{st.email}
              <span className="lr-sub">{st.verified ? 'Potwierdzony' : 'Niepotwierdzony: otwórz link z wiadomości albo wyślij go ponownie'}</span>
            </span>
            {st.verified ? <span className="badge">potwierdzony</span> : null}
          </div>
        </div>
      )}
      {editing ? (
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="em-addr">Adres e-mail</label>
            <input id="em-addr" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" maxLength={254} required />
          </div>
          <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            Zgadzam się na zapisanie adresu e-mail w celu odzyskiwania hasła. Zgodę wycofam, usuwając adres.</label>
          <div className="field">
            <label htmlFor="em-pw">Obecne hasło</label>
            <input id="em-pw" className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="row">
            <button className="btn" disabled={busy || !email || !pw}>{busy ? 'Zapisywanie…' : 'Zapisz i wyślij link'}</button>
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>Anuluj</button>
          </div>
        </form>
      ) : (
        <div className="row">
          {st.enabled && <button type="button" className="btn ghost" onClick={start}>{st.email ? (st.verified ? 'Zmień adres' : 'Zmień adres lub wyślij link ponownie') : 'Dodaj adres'}</button>}
          {st.email && <button type="button" className="btn ghost" onClick={remove}>Usuń adres</button>}
        </div>
      )}
      {err && <div className="alert error" role="alert">{err}</div>}
      <p role="status" className="muted">{msg}</p>
    </section>
  );
}
