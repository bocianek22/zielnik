'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavBadge from './NavBadge';
import ThemeToggle from './ThemeToggle';
import HideNowRow from './HideNowRow';
import Icon from './Icon';
import { isActive } from './TopNav';
import { navItems, SHEET_GROUPS } from './navItems';
import { VERSION } from '@/lib/version';

// UI 5: panel boczny na szerokim ekranie (od 1100 px, nav.css). Te same grupy co arkusz „Więcej” na telefonie;
// konto i ustawienia zwinięte na dole. Poniżej 1100 px ukryty, działa górny pasek z menu „Więcej”.
export default function SideNav({ isAdmin }) {
  const path = usePathname() || '';
  const sheet = navItems('sheet', isAdmin);
  const link = (i) => {
    const inner = (
      <>
        <span className="ic-dot sm" data-cat={i.cat}><Icon name={i.icon} size={18} /></span>
        <span className="side-label">{i.label}</span>
        {i.badge && <NavBadge kind={i.badge} />}
      </>
    );
    // pobranie pliku z API: zwykły odnośnik (Link próbowałby nawigacji po stronie klienta)
    return i.file ? <a key={i.href} href={i.href} className="side-link">{inner}</a>
      : <Link key={i.href} href={i.href} className="side-link" data-cat={i.cat} aria-current={isActive(path, i.href) ? 'page' : undefined}>{inner}</Link>;
  };
  return (
    <nav className="sidenav" aria-label="Nawigacja boczna">
      <div className="side-group">{navItems('bar', isAdmin).map(link)}</div>
      {SHEET_GROUPS.filter(([g]) => g !== 'account').map(([g, title]) => (
        <section key={g} className="side-group" aria-label={title}>
          <h2 className="side-title">{title}</h2>
          {sheet.filter((i) => i.sheet === g).map(link)}
        </section>
      ))}
      <details className="side-group side-account">
        <summary className="side-title">Konto i ustawienia<Icon name="chevronDown" size={16} /></summary>
        {sheet.filter((i) => i.sheet === 'account').map(link)}
        <HideNowRow />
        <ThemeToggle variant="row" />
        <span className="ver">Zielnik v{VERSION}</span>
      </details>
    </nav>
  );
}
