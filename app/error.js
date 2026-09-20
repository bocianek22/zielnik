'use client';

export default function ErrorPage({ error, reset }) {
  return (
    <main className="page">
      <div className="card empty">
        <h1>Coś poszło nie tak</h1>
        <p className="muted">Wystąpił błąd. Spróbuj ponownie. Jeśli problem się powtarza, podaj administratorowi ten kod: <code>{error?.digest || 'brak'}</code></p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={reset}>Spróbuj ponownie</button>
          <a className="btn ghost" href="/">Wróć do listy odmian</a>
        </div>
      </div>
    </main>
  );
}
