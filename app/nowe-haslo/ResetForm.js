'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { readLinkToken } from '@/lib/link-token';

// Ustawienie nowego hasła z linku e-mail. Token jest we fragmencie (#t=...): nie trafia do serwera ani do historii,
// bo zaraz po wczytaniu usuwamy go z paska adresu.
export default function ResetForm() {
  const token = useRef('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [bad, setBad] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { token.current = readLinkToken() || token.current; }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!token.current) return setError('Link jest niepełny. Otwórz go ponownie z wiadomości albo poproś o nowy.');
    if (password.length < 8) { setBad('n'); document.getElementById('n')?.focus(); return setError('Nowe hasło musi mieć co najmniej 8 znaków.'); }
    if (password !== repeat) { setBad('r'); document.getElementById('r')?.focus(); return setError('Hasła nie są takie same.'); }
    setBad('');
    setBusy(true);
    try {
      await api('/api/auth/reset', 'POST', { token: token.current, password });
      token.current = '';
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-box">
        <h1>Hasło zmienione</h1>
        <div className="alert ok" role="status">Nowe hasło jest ustawione. Wszystkie urządzenia zostały wylogowane.</div>
        <a className="btn" href="/login">Zaloguj się</a>
      </div>
    );
  }
  return (
    <form className="auth-box" onSubmit={submit} noValidate>
      <h1>Ustaw nowe hasło</h1>
      <p className="auth-lead">Po zmianie hasła wylogujemy wszystkie urządzenia.</p>
      <div className="field">
        <label htmlFor="n">Nowe hasło</label>
        <input id="n" className="input" type="password" aria-invalid={bad === 'n' || undefined} aria-describedby="n-hint" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={100} required />
        <p id="n-hint" className="muted small">Co najmniej 8 znaków.</p>
      </div>
      <div className="field">
        <label htmlFor="r">Powtórz nowe hasło</label>
        <input id="r" className="input" type="password" aria-invalid={bad === 'r' || undefined} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" maxLength={100} required />
      </div>
      {error && <div className="alert error" role="alert">{error}</div>}
      <button type="submit" className="btn" disabled={busy}>{busy ? 'Zapisywanie…' : 'Zapisz hasło'}</button>
      <p className="auth-alt"><a href="/odzyskaj-haslo">Poproś o nowy link</a> · <a href="/login">Logowanie</a></p>
    </form>
  );
}
