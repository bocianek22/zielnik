'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import useFocusTrap from './useFocusTrap';
import { usePathname, useRouter } from 'next/navigation';
import NavBadge from './NavBadge';
import ThemeToggle from './ThemeToggle';
import LogoutButton from './LogoutButton';
import Icon from './Icon';
import { isActive } from './TopNav';
import { navItems, SHEET_GROUPS } from './navItems';
import { VERSION } from '@/lib/version';

// Dolny pasek nawigacji dla telefonów (widoczny tylko poniżej 760 px): Dziś, Odmiany, „+” (menu dodawania), Dziennik, Więcej (arkusz)
// Ekran do zgłoszenia bez identyfikatorów i nazw kont: adres trafia do historii przeglądarki i logów żądań
const screenOf = (p) => p.replace(/^\/u\/[^/]+/, '/u/:handle').replace(/\/\d+(?=\/|$)/g, '/:id');

export default function BottomNav({ isAdmin }) {
  const path = usePathname() || '';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fab, setFab] = useState(false);
  useEffect(() => { setOpen(false); setFab(false); }, [path]);
  const sheetRef = useRef(null);
  const fabRef = useRef(null);
  const closeAll = () => { setOpen(false); setFab(false); };
  useFocusTrap(sheetRef, open, closeAll);
  useFocusTrap(fabRef, fab, closeAll);

  function newStrain() {
    setFab(false);
    if (path === '/odmiany') window.dispatchEvent(new Event('zielnik:new-strain'));
    else router.push('/odmiany?new=1');
  }

  const sheet = navItems('sheet', isAdmin);
  const bar = navItems('bar', isAdmin);
  const tab = (i) => {
    const on = !open && !fab && isActive(path, i.href); // przy otwartym arkuszu aktywna jest tylko zakładka „Więcej”
    return (
      <Link key={i.href} href={i.href} className={on ? 'on' : ''} data-cat={i.cat} aria-current={on ? 'page' : undefined}>
        <span className="bn-ic"><Icon name={i.icon} /></span><span>{i.short || i.label}</span>{i.badge && <NavBadge kind={i.badge} />}
      </Link>
    );
  };
  return (
    <>
      {(open || fab) && <div className="sheet-backdrop" onClick={closeAll} aria-hidden="true" />}
      {fab && (
        <div className="fab-menu list" role="menu" ref={fabRef}>
          <button type="button" role="menuitem" className="list-row" onClick={newStrain}><span className="ic-dot sm" data-cat="strain"><Icon name="jar" size={18} /></span><span className="lr-main">Nowa odmiana</span></button>
          <Link href="/dziennik" role="menuitem" className="list-row"><span className="ic-dot sm" data-cat="journal"><Icon name="pulse" size={18} /></span><span className="lr-main">Objawy dnia</span></Link>
          <Link href="/historia" role="menuitem" className="list-row"><span className="ic-dot sm" data-cat="stock"><Icon name="clock" size={18} /></span><span className="lr-main">Historia zużycia i zakupów</span></Link>
        </div>
      )}
      {open && (
        <nav className="sheet" aria-label="Więcej" ref={sheetRef}>
          {SHEET_GROUPS.map(([g, title]) => {
            const items = sheet.filter((i) => i.sheet === g);
            if (!items.length) return null;
            return (
              <section key={g}>
                <h2 className="section-label">{title}</h2>
                <div className="list">
                  {items.map((i) => {
                    const inner = (
                      <>
                        <span className="ic-dot sm" data-cat={i.cat}><Icon name={i.icon} size={18} /></span><span className="lr-main">{i.label}</span>
                        {i.badge && <NavBadge kind={i.badge} />}
                        <Icon name={i.file ? 'download' : 'chevronRight'} size={18} className="lr-chev" />
                      </>
                    );
                    // pobranie pliku z API: zwykły odnośnik (Link próbowałby nawigacji po stronie klienta)
                    return i.file ? <a key={i.href} href={i.href} className="list-row">{inner}</a> : (
                      <Link key={i.href} href={i.href === '/uwagi' && path ? `/uwagi?ekran=${encodeURIComponent(screenOf(path))}` : i.href} className="list-row" aria-current={isActive(path, i.href) ? 'page' : undefined}>{inner}</Link>
                    );
                  })}
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
        {bar.slice(0, 2).map(tab)}
        {/* „+” w środku paska: nie zasłania treści; menu dodawania (odmiana, objawy, historia) */}
        <span className="bn-add">
          <button type="button" className="fab" onClick={() => { setOpen(false); setFab((f) => !f); }} aria-label={fab ? 'Zamknij menu dodawania' : 'Dodaj'} aria-expanded={fab}>
            <Icon name={fab ? 'close' : 'plus'} />
          </button>
        </span>
        {bar.slice(2).map(tab)}
        <button type="button" className={open ? 'on' : ''} onClick={() => { setFab(false); setOpen((o) => !o); }} aria-expanded={open}>
          {/* Znajomi i Grupy są w arkuszu: zaproszenia widać na przycisku */}
          <span className="bn-ic"><Icon name="more" /></span><span>Więcej</span><NavBadge kind="social" />
        </button>
      </nav>
    </>
  );
}
