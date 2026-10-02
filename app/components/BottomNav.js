'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NavBadge from './NavBadge';
import ThemeToggle from './ThemeToggle';
import Leaf from './Leaf';
import { navItems } from './navItems';
import { VERSION } from '@/lib/version';

const I = (p) => <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>;
const ICONS = {
  leaf: <Leaf size={24} />,
  katalog: I(<path d="M4 6h16M4 12h16M4 18h10" />),
  szukaj: I(<><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>),
  znajomi: I(<><circle cx="9" cy="8" r="3" /><path d="M3 20c0-4 3-6 6-6s6 2 6 6" /><circle cx="17" cy="9" r="2.5" /></>),
  wiecej: I(<><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>),
};

// Dolny pasek nawigacji dla telefonów (widoczny tylko poniżej 760 px) z arkuszem "Więcej"
export default function BottomNav({ isAdmin }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fab, setFab] = useState(false);
  useEffect(() => { setOpen(false); setFab(false); }, [path]);

  function newStrain() {
    setFab(false);
    if (path === '/') window.dispatchEvent(new Event('zielnik:new-strain'));
    else router.push('/?new=1');
  }

  const active = (href) => (href === '/' ? path === '/' || path.startsWith('/strains') : path.startsWith(href));
  const Tab = ({ href, label, icon, badge }) => (
    <Link href={href} className={active(href) ? 'on' : ''} aria-current={active(href) ? 'page' : undefined}>
      {icon}<span>{label}</span>{badge}
    </Link>
  );

  return (
    <>
      {(open || fab) && <div className="sheet-backdrop" onClick={() => { setOpen(false); setFab(false); }} />}
      {fab && (
        <div className="fab-menu" role="menu">
          <button type="button" role="menuitem" onClick={newStrain}>Nowa odmiana</button>
          <Link href="/dziennik" role="menuitem">Objawy dnia</Link>
          <Link href="/historia" role="menuitem">Historia zużycia i zakupów</Link>
        </div>
      )}
      <button type="button" className="fab" onClick={() => { setOpen(false); setFab((f) => !f); }} aria-label="Dodaj" aria-expanded={fab}>{fab ? '×' : '+'}</button>
      {open && (
        <nav className="sheet" aria-label="Więcej">
          {navItems('sheet', isAdmin).map((i) => (
            <Link key={i.href} href={i.href}>{i.label}{i.badge && <NavBadge kind={i.badge} />}</Link>
          ))}
          <ThemeToggle />
          <span className="ver">Zielnik v{VERSION}</span>
        </nav>
      )}
      <nav className="bottomnav" aria-label="Główna nawigacja">
        {navItems('bar', isAdmin).map((i) => <Tab key={i.href} href={i.href} label={i.label} icon={ICONS[i.icon]} badge={i.badge && <NavBadge kind={i.badge} />} />)}
        <button type="button" className={open ? 'on' : ''} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {ICONS.wiecej}<span>Więcej</span>
        </button>
      </nav>
    </>
  );
}
