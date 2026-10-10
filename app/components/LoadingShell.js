import Link from 'next/link';
import Leaf from './Leaf';
import BottomNav from './BottomNav';
import Skeleton from './Skeleton';

// Ekran wczytywania (loading.js): górny i dolny pasek zostają na miejscu, a w treści jest szkielet w kształcie ekranu.
// Header renderuje każda strona z danymi użytkownika, więc tu jest jego lekka kopia (bez nazwy konta i plakietek admina).
export default function LoadingShell({ title, variant = 'screen', rows }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link href="/" className="brand"><Leaf size={24} /><span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span></Link>
        </div>
      </header>
      <BottomNav isAdmin={false} />
      <main className="page">
        {title && <h1>{title}</h1>}
        <Skeleton variant={variant} rows={rows} />
      </main>
    </>
  );
}
