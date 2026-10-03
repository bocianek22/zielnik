'use client';
import { useEffect } from 'react';
import Icon from './components/Icon';

export default function ErrorPage({ error, reset }) {
  useEffect(() => {
    fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ digest: error?.digest, message: error?.message, path: location.pathname }) }).catch(() => {});
  }, [error]);
  return (
    <main className="page">
      <div className="empty system-state" role="alert">
        <Icon name="alert" size={32} />
        <h1>Coś poszło nie tak</h1>
        <p>Nie udało się wyświetlić tej strony. Spróbuj ponownie albo wróć do odmian.</p>
        <p className="small system-code">Jeśli problem się powtarza, podaj administratorowi kod: <code>{error?.digest || 'brak'}</code></p>
        <div className="system-actions">
          <button className="btn" onClick={reset}>Spróbuj ponownie</button>
          <a className="btn text" href="/">Wróć do odmian</a>
        </div>
      </div>
    </main>
  );
}
