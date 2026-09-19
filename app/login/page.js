'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Leaf from '../components/Leaf';
import { api } from '@/lib/api';

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
        <div className="brand"><Leaf size={34} /><span>Zielnik</span></div>
        <Leaf size={520} className="bigleaf" />
        <p className="auth-tagline">Dziennik odmian medycznej konopi: stan, oceny i spostrzeżenia w jednym miejscu.</p>
      </aside>
      <main className="auth-form">
        <form className="auth-box" onSubmit={submit}>
          <h1>Zaloguj się</h1>
          <div className="field">
            <label htmlFor="u">Nazwa użytkownika</label>
            <input id="u" className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
          </div>
          <div className="field">
            <label htmlFor="p">Hasło</label>
            <input id="p" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button className="btn" disabled={busy}>{busy ? 'Logowanie…' : 'Zaloguj się'}</button>
        </form>
      </main>
    </div>
  );
}
