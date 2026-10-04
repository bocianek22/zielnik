import Link from 'next/link';
import Leaf from './Leaf';
import Icon from './Icon';
import LogoutButton from './LogoutButton';
import OfflineQueue from './OfflineQueue';
import NavBadge from './NavBadge';
import MoreMenu from './MoreMenu';
import ThemeToggle from './ThemeToggle';
import BottomNav from './BottomNav';
import TopNav from './TopNav';
import { navItems } from './navItems';
import { VERSION } from '@/lib/version';

export default function Header({ user }) {
  const admin = !!user.is_admin;
  // pozycje bez funkcji JS: do komponentu klienckiego trafiają tylko proste dane
  const plain = (list) => list.map(({ href, label, badge }) => ({ href, label, badge }));
  return (
    <>
    <header className="topbar">
      <div className="topbar-in">
        <Link href="/" className="brand">
          <Leaf size={24} />
          <span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span>
        </Link>
        <nav className="nav" aria-label="Główna nawigacja">
          <TopNav items={plain(navItems('main', admin))} />
          <MoreMenu badge={admin ? <NavBadge kind="admin" /> : null}>
            {navItems('more', admin).map((i) => <Link key={i.href} href={i.href}>{i.label}{i.badge && <NavBadge kind={i.badge} />}</Link>)}
            <hr />
            <ThemeToggle />
            <span className="ver">Zielnik v{VERSION}</span>
          </MoreMenu>
        </nav>
        <div className="who">
          <OfflineQueue userId={user.id} />
          <Link href="/profil" className="who-name">{user.username}</Link>
          <LogoutButton />
          <Link href="/profil" className="icon-btn who-mobile" aria-label={`Mój profil (${user.username})`}><Icon name="user" /></Link>
        </div>
      </div>
    </header>
    <BottomNav isAdmin={admin} />
    </>
  );
}
