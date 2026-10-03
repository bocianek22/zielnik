'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavBadge from './NavBadge';

export const isActive = (path, href) => (href === '/' ? path === '/' || path.startsWith('/strains') : path.startsWith(href));

// Linki górnego paska z zaznaczeniem bieżącej strony (Header jest komponentem serwerowym)
export default function TopNav({ items }) {
  const path = usePathname() || '';
  return items.map((i) => (
    <Link key={i.href} href={i.href} aria-current={isActive(path, i.href) ? 'page' : undefined}>
      {i.label}{i.badge && <NavBadge kind={i.badge} />}
    </Link>
  ));
}
