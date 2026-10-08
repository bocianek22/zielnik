'use client';
import { useState } from 'react';
import { api } from '@/lib/api';

// Prośba o link do ustawienia nowego hasła. Odpowiedź serwera jest zawsze taka sama (nie zdradza, czy konto istnieje).
export default function ForgotForm() {
  const [login, setLogin] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const r = await api('/api/auth/forgot', 'POST', { login });
      setDone(r.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-box" onSubmit={submit}>
      <h1>Nie pamiętam hasła</h1>
      <p className="auth-lead">Podaj nazwę użytkownika albo adres e-mail. Link do ustawienia nowego hasła wyślemy tylko na adres potwierdzony w profilu.</p>
      {done ? <div className="alert ok" role="status">{done}</div> : (
        <>
          <div className="field">
            <label htmlFor="f-login">Nazwa użytkownika lub e-mail</label>
            <input id="f-login" className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" maxLength={254} autoFocus required />
          </div>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button type="submit" className="btn" disabled={busy}>{busy ? 'Wysyłanie…' : 'Wyślij link'}</button>
        </>
      )}
      <p className="auth-alt"><a href="/login">Wróć do logowania</a></p>
    </form>
  );
}
