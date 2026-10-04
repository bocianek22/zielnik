'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Leaf from '../components/Leaf';
import Icon from '../components/Icon';
import { api } from '@/lib/api';
import { markFreshLogin } from '@/lib/applock';

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ invite: '', username: '', password: '', adult: false, consent: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const code = new URLSearchParams(location.search).get('code');
    if (code) setF((p) => ({ ...p, invite: code }));
  }, []);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try { await api('/api/auth/register', 'POST', f); markFreshLogin(f.username); router.replace('/profil'); router.refresh(); }
    catch (err) { setError(err.message); setBusy(false); }
  }

  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="brand"><Leaf size={28} /><span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span></div>
        <p className="auth-tagline">Dołącz do zamkniętej społeczności pacjentów. Rejestracja wymaga kodu zaproszenia.</p>
        <ul className="auth-points">
          <li><Icon name="list" size={20} />Stan zapasu, zużycie i wykupy w jednym miejscu</li>
          <li><Icon name="pulse" size={20} />Dziennik objawów i raport dla lekarza</li>
          <li><Icon name="shield" size={20} />Dane prywatne, widoczność ustawiasz sam</li>
        </ul>
      </aside>
      <main className="auth-form">
        <form className="auth-box" onSubmit={submit}>
          <div className="brand auth-mark" aria-hidden="true"><span className="mark"><Leaf size={26} /></span><span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span></div>
          <h1>Załóż konto</h1>
          <p className="auth-lead">Rejestracja wymaga kodu zaproszenia.</p>
          <div className="field"><label htmlFor="r-code">Kod zaproszenia</label>
            <input id="r-code" className="input" value={f.invite} onChange={set('invite')} required autoComplete="off" /></div>
          <div className="field"><label htmlFor="r-user">Nazwa użytkownika (unikalna, widoczna w adresie profilu)</label>
            <input id="r-user" className="input" value={f.username} onChange={set('username')} required minLength={3} maxLength={24} autoComplete="username" /></div>
          <div className="field"><label htmlFor="r-pass">Hasło (min. 8 znaków)</label>
            <input id="r-pass" className="input" type="password" value={f.password} onChange={set('password')} required minLength={8} autoComplete="new-password" /></div>
          <label className="check"><input type="checkbox" checked={f.adult} onChange={set('adult')} /> Mam ukończone 18 lat</label>
          <label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} />
            <span>Akceptuję <a href="/prywatnosc" target="_blank">regulamin i politykę prywatności</a></span></label>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Zakładam konto…' : 'Załóż konto'}</button>
          <p className="auth-alt">Masz już konto? <a href="/login">Zaloguj się</a></p>
        </form>
      </main>
    </div>
  );
}
