import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page">
      <div className="card empty">
        <h1>Nie znaleziono strony</h1>
        <p className="muted">Ta strona nie istnieje albo nie masz do niej dostępu.</p>
        <Link className="btn" href="/">Wróć do listy odmian</Link>
      </div>
    </main>
  );
}
