'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { readLinkToken } from '@/lib/link-token';

// Potwierdzenie adresu e-mail z linku. Potwierdza dopiero przycisk: skanery linków w poczcie otwierają stronę,
// ale nie klikają, więc nie zużyją tokenu.
export default function VerifyEmail() {
  const token = useRef('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { token.current = readLinkToken() || token.current; }, []);

  async function confirm() {
    setError('');
    if (!token.current) return setError('Link jest niepełny. Otwórz go ponownie z wiadomości albo wyślij nowy w profilu.');
    setBusy(true);
    try {
      await api('/api/account/email/verify', 'POST', { token: token.current });
      token.current = '';
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-box">
      <h1>Potwierdzenie adresu e-mail</h1>
      {done ? <div className="alert ok" role="status">Adres potwierdzony. Możesz go teraz użyć do odzyskania hasła.</div> : (
        <>
          <p className="auth-lead">Potwierdź, że ten adres należy do Ciebie. Będzie używany tylko do odzyskiwania hasła.</p>
          {error && <div className="alert error" role="alert">{error}</div>}
          <button type="button" className="btn" onClick={confirm} disabled={busy}>{busy ? 'Potwierdzanie…' : 'Potwierdź adres'}</button>
        </>
      )}
      <p className="auth-alt"><a href="/profil">Przejdź do profilu</a></p>
    </div>
  );
}
