// Jedna definicja pozycji menu dla górnego paska (Header), dolnego paska i arkusza „Więcej” (BottomNav).
// Kolejność na liście = kolejność w każdym menu, w którym pozycja się pojawia.
//  badge: rodzaj plakietki NavBadge, admin: tylko dla admina,
//  bar: zakładka dolnego paska, top: 'main' (górny pasek) | 'more' (rozwijane „Więcej” na desktopie),
//  sheet: grupa w arkuszu „Więcej” na telefonie ('journal' | 'discover' | 'account'; pozycja bez top, np. /profil,
//  jest na desktopie pod nazwą użytkownika), icon: nazwa ikony z app/components/Icon.js.
export const NAV_ITEMS = [
  { href: '/', label: 'Odmiany', bar: true, top: 'main', icon: 'list' },
  { href: '/katalog', label: 'Katalog', bar: true, top: 'main', icon: 'book' },
  { href: '/szukaj', label: 'Szukaj', bar: true, top: 'main', icon: 'search' },
  { href: '/znajomi', label: 'Znajomi', badge: 'friends', bar: true, top: 'main', icon: 'users' },
  { href: '/wheel', label: 'Koło fortuny', top: 'more', sheet: 'discover', icon: 'shuffle' },
  { href: '/rankings', label: 'Rankingi', top: 'more', sheet: 'discover', icon: 'chart' },
  { href: '/grupy', label: 'Grupy', badge: 'groups', top: 'main', sheet: 'discover', icon: 'group' },
  { href: '/historia', label: 'Historia', top: 'more', sheet: 'journal', icon: 'clock' },
  { href: '/dziennik', label: 'Dziennik objawów', top: 'more', sheet: 'journal', icon: 'pulse' },
  { href: '/recepty', label: 'Recepty', top: 'more', sheet: 'journal', icon: 'file' },
  { href: '/raport', label: 'Raport dla lekarza', top: 'more', sheet: 'journal', icon: 'clipboard' },
  { href: '/wiedza', label: 'Wiedza', top: 'more', sheet: 'discover', icon: 'info' },
  { href: '/premium', label: 'Premium i wsparcie', top: 'more', sheet: 'account', icon: 'heart' },
  { href: '/profil', label: 'Mój profil', sheet: 'account', icon: 'user' },
  { href: '/admin', label: 'Użytkownicy', badge: 'admin', admin: true, top: 'more', sheet: 'account', icon: 'shield' },
  { href: '/change-password', label: 'Zmień hasło', top: 'more', sheet: 'account', icon: 'key' },
];

// Grupy arkusza „Więcej” w kolejności wyświetlania
export const SHEET_GROUPS = [['journal', 'Dziennik'], ['discover', 'Odkrywaj'], ['account', 'Konto']];

// place: 'bar' | 'main' | 'more' | 'sheet'
export function navItems(place, isAdmin) {
  return NAV_ITEMS.filter((i) => (!i.admin || isAdmin) && (place === 'bar' ? i.bar : place === 'sheet' ? i.sheet : i.top === place));
}
