import Link from 'next/link';
import Leaf from './Leaf';
import LogoutButton from './LogoutButton';

export default function Header({ user }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <Leaf size={30} />
          <span>Zielnik</span>
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          <Link href="/">Odmiany</Link>
          <Link href="/wheel">Koło fortuny</Link>
          <Link href="/rankings">Rankingi</Link>
          {user.is_admin && <Link href="/admin">Użytkownicy</Link>}
          <Link href="/change-password">Zmień hasło</Link>
        </nav>
        <div className="who">
          <span className="who-name">{user.username}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
