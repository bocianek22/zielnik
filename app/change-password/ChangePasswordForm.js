'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function ChangePasswordForm({ forced }) {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Nowe hasło musi mieć co najmniej 8 znaków.');
    if (password !== repeat) return setError('Hasła nie są takie same.');
    setBusy(true);
    try {
      await api('/api/auth/change-password', 'POST', { current, password });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="card narrow" onSubmit={submit}>
      <h1>{forced ? 'Ustaw własne hasło' : 'Zmień hasło'}</h1>
      {forced && <p className="muted">To Twoje pierwsze logowanie. Zanim przejdziesz dalej, zastąp hasło tymczasowe własnym.</p>}
      <div className="field">
        <label htmlFor="c">{forced ? 'Hasło tymczasowe' : 'Obecne hasło'}</label>
        <input id="c" className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      <div className="field">
        <label htmlFor="n">Nowe hasło</label>
        <input id="n" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
      </div>
      <div className="field">
        <label htmlFor="r">Powtórz nowe hasło</label>
        <input id="r" className="input" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <button className="btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz hasło'}</button>
    </form>
  );
}
