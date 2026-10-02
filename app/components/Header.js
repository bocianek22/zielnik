import Link from 'next/link';
import Leaf from './Leaf';
import LogoutButton from './LogoutButton';
import NavBadge from './NavBadge';
import MoreMenu from './MoreMenu';
import ThemeToggle from './ThemeToggle';
import BottomNav from './BottomNav';
import { navItems } from './navItems';
import { VERSION } from '@/lib/version';

export default function Header({ user }) {
  const admin = !!user.is_admin;
  return (
    <>
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <Leaf size={30} />
          <span>Zielnik</span>
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          {navItems('main', admin).map((i) => <Link key={i.href} href={i.href}>{i.label}{i.badge && <NavBadge kind={i.badge} />}</Link>)}
          <MoreMenu badge={admin ? <NavBadge kind="admin" /> : null}>
            {navItems('more', admin).map((i) => <Link key={i.href} href={i.href}>{i.label}{i.badge && <NavBadge kind={i.badge} />}</Link>)}
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
    <BottomNav isAdmin={admin} />
    </>
  );
}
