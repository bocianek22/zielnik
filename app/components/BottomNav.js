'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import NavBadge from './NavBadge';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import Icon from './Icon';
import { isActive } from './TopNav';
import { navItems, SHEET_GROUPS } from './navItems';
import { VERSION } from '@/lib/version';

// Dolny pasek nawigacji dla telefonów (widoczny tylko poniżej 760 px) z arkuszem "Więcej"
export default function BottomNav({ isAdmin }) {
  const path = usePathname() || '';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fab, setFab] = useState(false);
  useEffect(() => { setOpen(false); setFab(false); }, [path]);
  useEffect(() => {
    if (!open && !fab) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { setOpen(false); setFab(false); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, fab]);

  function newStrain() {
    setFab(false);
    if (path === '/') window.dispatchEvent(new Event('zielnik:new-strain'));
    else router.push('/?new=1');
  }

  const sheet = navItems('sheet', isAdmin);
  return (
    <>
      {(open || fab) && <div className="sheet-backdrop" onClick={() => { setOpen(false); setFab(false); }} />}
      {fab && (
        <div className="fab-menu list" role="menu">
          <button type="button" role="menuitem" className="list-row" onClick={newStrain}><Icon name="plus" /><span className="lr-main">Nowa odmiana</span></button>
          <Link href="/dziennik" role="menuitem" className="list-row"><Icon name="pulse" /><span className="lr-main">Objawy dnia</span></Link>
          <Link href="/historia" role="menuitem" className="list-row"><Icon name="clock" /><span className="lr-main">Historia zużycia i zakupów</span></Link>
        </div>
      )}
      {!open && (
        <button type="button" className="fab" onClick={() => setFab((f) => !f)} aria-label={fab ? 'Zamknij' : 'Dodaj'} aria-expanded={fab}>
          <Icon name={fab ? 'close' : 'plus'} />
        </button>
      )}
      {open && (
        <nav className="sheet" aria-label="Więcej">
          {SHEET_GROUPS.map(([g, title]) => {
            const items = sheet.filter((i) => i.sheet === g);
            if (!items.length) return null;
            return (
              <section key={g}>
                <h2 className="section-label">{title}</h2>
                <div className="list">
                  {items.map((i) => (
                    <Link key={i.href} href={i.href} className="list-row" aria-current={isActive(path, i.href) ? 'page' : undefined}>
                      <Icon name={i.icon} /><span className="lr-main">{i.label}</span>
                      {i.badge && <NavBadge kind={i.badge} />}
                      <Icon name="chevronRight" size={18} className="lr-chev" />
                    </Link>
                  ))}
                  {g === 'account' && <ThemeToggle variant="row" />}
                  {g === 'account' && (
                    <LogoutButton className="list-row logout"><Icon name="logout" /><span className="lr-main">Wyloguj</span></LogoutButton>
                  )}
                </div>
              </section>
            );
          })}
          <span className="ver">Zielnik v{VERSION}</span>
        </nav>
      )}
      <nav className="bottomnav" aria-label="Główna nawigacja">
        {navItems('bar', isAdmin).map((i) => {
          const on = !open && isActive(path, i.href); // przy otwartym arkuszu aktywna jest tylko zakładka „Więcej”
          return (
            <Link key={i.href} href={i.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
              <span className="bn-ic"><Icon name={i.icon} /></span><span>{i.label}</span>{i.badge && <NavBadge kind={i.badge} />}
            </Link>
          );
        })}
        <button type="button" className={open ? 'on' : ''} onClick={() => { setFab(false); setOpen((o) => !o); }} aria-expanded={open}>
          <span className="bn-ic"><Icon name="more" /></span><span>Więcej</span>
        </button>
      </nav>
    </>
  );
}
