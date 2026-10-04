'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Leaf from '../components/Leaf';
import Icon from '../components/Icon';
import { api } from '@/lib/api';
import { markFreshLogin } from '@/lib/applock';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api('/api/auth/login', 'POST', { username, password });
      markFreshLogin(username);
      router.replace(r.mustChange ? '/change-password' : '/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth-art">
        <div className="brand"><Leaf size={28} /><span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span></div>
        <p className="auth-tagline">Dziennik odmian medycznej konopi: stan, oceny i spostrzeżenia w jednym miejscu.</p>
        <ul className="auth-points">
          <li><Icon name="list" size={20} />Stan zapasu, zużycie i wykupy w jednym miejscu</li>
          <li><Icon name="pulse" size={20} />Dziennik objawów i raport dla lekarza</li>
          <li><Icon name="shield" size={20} />Dane prywatne, widoczność ustawiasz sam</li>
        </ul>
      </aside>
      <main className="auth-form">
        <form className="auth-box" onSubmit={submit}>
          <div className="brand auth-mark" aria-hidden="true"><span className="mark"><Leaf size={26} /></span><span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span></div>
          <h1>Zaloguj się</h1>
          <p className="auth-lead">Dziennik odmian medycznej konopi.</p>
          <div className="field">
            <label htmlFor="u">Nazwa użytkownika</label>
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="p">Hasło</label>
            <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Logowanie…' : 'Zaloguj się'}</button>
          <p className="auth-alt">Masz kod zaproszenia? <a href="/register">Załóż konto</a></p>
        </form>
      </main>
    </div>
  );
}
