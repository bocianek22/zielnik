// Jedna definicja pozycji menu dla górnego paska (Header), dolnego paska i arkusza „Więcej” (BottomNav).
// Kolejność na liście = kolejność w każdym menu, w którym pozycja się pojawia.
//  badge: rodzaj plakietki NavBadge, admin: tylko dla admina,
//  bar: zakładka dolnego paska, top: 'main' (górny pasek) | 'more' (rozwijane „Więcej” na desktopie),
//  sheet: arkusz „Więcej” na telefonie (pozycja bez top, np. /profil, jest na desktopie pod nazwą użytkownika).
export const NAV_ITEMS = [
  { href: '/', label: 'Odmiany', bar: true, top: 'main', icon: 'leaf' },
  { href: '/katalog', label: 'Katalog', bar: true, top: 'main', icon: 'katalog' },
  { href: '/szukaj', label: 'Szukaj', bar: true, top: 'main', icon: 'szukaj' },
  { href: '/znajomi', label: 'Znajomi', badge: 'friends', bar: true, top: 'main', icon: 'znajomi' },
  { href: '/wheel', label: 'Koło fortuny', top: 'more', sheet: true },
  { href: '/rankings', label: 'Rankingi', top: 'more', sheet: true },
  { href: '/grupy', label: 'Grupy', badge: 'groups', top: 'main', sheet: true },
  { href: '/historia', label: 'Historia', top: 'more', sheet: true },
  { href: '/dziennik', label: 'Dziennik objawów', top: 'more', sheet: true },
  { href: '/recepty', label: 'Recepty', top: 'more', sheet: true },
  { href: '/raport', label: 'Raport dla lekarza', top: 'more', sheet: true },
  { href: '/wiedza', label: 'Wiedza', top: 'more', sheet: true },
  { href: '/premium', label: 'Premium i wsparcie', top: 'more', sheet: true },
  { href: '/profil', label: 'Mój profil', sheet: true },
  { href: '/admin', label: 'Użytkownicy', badge: 'admin', admin: true, top: 'more', sheet: true },
  { href: '/change-password', label: 'Zmień hasło', top: 'more', sheet: true },
];

// place: 'bar' | 'main' | 'more' | 'sheet'
export function navItems(place, isAdmin) {
  return NAV_ITEMS.filter((i) => (!i.admin || isAdmin) && (place === 'bar' ? i.bar : place === 'sheet' ? i.sheet : i.top === place));
}
