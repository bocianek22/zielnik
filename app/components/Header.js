import Link from 'next/link';
import Leaf from './Leaf';
import LogoutButton from './LogoutButton';
import NavBadge from './NavBadge';
import MoreMenu from './MoreMenu';
import ThemeToggle from './ThemeToggle';
import BottomNav from './BottomNav';
import { VERSION } from '@/lib/version';

export default function Header({ user }) {
  return (
    <>
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <Leaf size={30} />
          <span>Zielnik</span>
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          <Link href="/">Odmiany</Link>
          <Link href="/katalog">Katalog</Link>
          <Link href="/szukaj">Szukaj</Link>
          <Link href="/znajomi">Znajomi<NavBadge kind="friends" /></Link>
          <Link href="/grupy">Grupy<NavBadge kind="groups" /></Link>
          <MoreMenu badge={user.is_admin ? <NavBadge kind="admin" /> : null}>
            <Link href="/wheel">Koło fortuny</Link>
            <Link href="/rankings">Rankingi</Link>
            <Link href="/historia">Historia</Link>
            <Link href="/dziennik">Dziennik objawów</Link>
            <Link href="/recepty">Recepty</Link>
            <Link href="/raport">Raport dla lekarza</Link>
            <Link href="/premium">Premium i wsparcie</Link>
            <Link href="/wiedza">Wiedza</Link>
            {user.is_admin && <Link href="/admin">Użytkownicy<NavBadge kind="admin" /></Link>}
            <Link href="/change-password">Zmień hasło</Link>
            <ThemeToggle />
            <span className="ver">Zielnik v{VERSION}</span>
          </MoreMenu>
        </nav>
        <div className="who">
          <Link href="/profil" className="who-name">{user.username}</Link>
          <LogoutButton />
        </div>
      </div>
    </header>
    <BottomNav isAdmin={!!user.is_admin} />
    </>
  );
}
