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
  const [bad, setBad] = useState(''); // pole z błędem (id)
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setBad('n'); document.getElementById('n')?.focus(); return setError('Nowe hasło musi mieć co najmniej 8 znaków.'); }
    if (password !== repeat) { setBad('r'); document.getElementById('r')?.focus(); return setError('Hasła nie są takie same.'); }
    setBad('');
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
    <form className="pw-form" onSubmit={submit} noValidate>
      <h1>{forced ? 'Ustaw własne hasło' : 'Zmień hasło'}</h1>
      {forced && <p className="muted pw-lead">To Twoje pierwsze logowanie. Zanim przejdziesz dalej, zastąp hasło tymczasowe własnym.</p>}
      {error && <div className="alert error" role="alert">{error}</div>}
      <h2 className="section-label">Obecne hasło</h2>
      <div className="card">
      <div className="field">
        <label htmlFor="c">{forced ? 'Hasło tymczasowe' : 'Obecne hasło'}</label>
        <input id="c" className="input" type="password" aria-invalid={bad === 'c' || undefined} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </div>
      </div>
      <h2 className="section-label">Nowe hasło</h2>
      <div className="card">
      <div className="field">
        <label htmlFor="n">Nowe hasło</label>
        <input id="n" className="input" type="password" aria-invalid={bad === 'n' || undefined} aria-describedby="n-hint" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={100} required />
        <p id="n-hint" className="muted small">Co najmniej 8 znaków.</p>
      </div>
      <div className="field">
        <label htmlFor="r">Powtórz nowe hasło</label>
        <input id="r" className="input" type="password" aria-invalid={bad === 'r' || undefined} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
      </div>
      </div>
      <button className="btn block" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz hasło'}</button>
    </form>
  );
}
