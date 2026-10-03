import Link from 'next/link';
import Icon from './components/Icon';

export default function NotFound() {
  return (
    <main className="page">
      <div className="empty system-state">
        <Icon name="search" size={32} />
        <h1>Nie znaleziono strony</h1>
        <p>Ta strona nie istnieje albo nie masz do niej dostępu.</p>
        <div className="system-actions">
          <Link className="btn" href="/">Wróć do odmian</Link>
        </div>
      </div>
    </main>
  );
}
