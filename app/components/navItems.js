// Jedna definicja pozycji menu dla górnego paska (Header), dolnego paska i arkusza „Więcej” (BottomNav).
// Kolejność na liście = kolejność w każdym menu, w którym pozycja się pojawia.
//  badge: rodzaj plakietki NavBadge, admin: tylko dla admina,
//  bar: zakładka dolnego paska (short: krótsza nazwa na pasku), top: 'main' (górny pasek) | 'more' (rozwijane „Więcej” na desktopie),
//  sheet: grupa w arkuszu „Więcej” na telefonie ('journal' | 'discover' | 'social' | 'account'; pozycja bez top, np. /profil,
//  jest na desktopie pod nazwą użytkownika), icon: nazwa ikony z app/components/Icon.js,
//  cat: kolor obszaru (docs/DESIGN-3.md: stock | journal | rx | strain | social | learn; brak = neutralny),
//  file: zwykły odnośnik <a> zamiast Link (pobieranie pliku z API).
export const NAV_ITEMS = [
  { href: '/', label: 'Dziś', bar: true, top: 'main', icon: 'home', cat: 'stock' },
  { href: '/odmiany', label: 'Odmiany', bar: true, top: 'main', icon: 'jar', cat: 'strain' },
  { href: '/dziennik', label: 'Dziennik objawów', short: 'Dziennik', bar: true, top: 'main', icon: 'pulse', cat: 'journal' },
  { href: '/historia', label: 'Historia', top: 'more', sheet: 'journal', icon: 'clock', cat: 'stock' },
  { href: '/recepty', label: 'Recepty', top: 'main', sheet: 'journal', icon: 'file', cat: 'rx' },
  { href: '/obserwacje', label: 'Moje obserwacje', top: 'more', sheet: 'journal', icon: 'chart', cat: 'journal' },
  { href: '/raport', label: 'Raport dla lekarza', top: 'more', sheet: 'journal', icon: 'clipboard', cat: 'learn' },
  { href: '/katalog', label: 'Katalog', top: 'main', sheet: 'discover', icon: 'book', cat: 'strain' },
  { href: '/szukaj', label: 'Szukaj', top: 'main', sheet: 'discover', icon: 'search', cat: 'strain' },
  { href: '/rankings', label: 'Rankingi', top: 'more', sheet: 'discover', icon: 'trend', cat: 'strain' },
  { href: '/wheel', label: 'Koło fortuny', top: 'more', sheet: 'discover', icon: 'shuffle', cat: 'strain' },
  { href: '/wiedza', label: 'Wiedza', top: 'more', sheet: 'discover', icon: 'info', cat: 'learn' },
  { href: '/znajomi', label: 'Znajomi', badge: 'friends', top: 'main', sheet: 'social', icon: 'users', cat: 'social' },
  { href: '/grupy', label: 'Grupy', badge: 'groups', top: 'more', sheet: 'social', icon: 'group', cat: 'social' },
  { href: '/profil', label: 'Mój profil', sheet: 'account', icon: 'user' },
  { href: '/api/export', label: 'Eksport odmian (CSV)', top: 'more', sheet: 'account', icon: 'download', file: true },
  { href: '/import', label: 'Import odmian (CSV)', top: 'more', sheet: 'account', icon: 'upload' },
  { href: '/premium', label: 'Premium i wsparcie', top: 'more', sheet: 'account', icon: 'heart' },
  { href: '/pomoc', label: 'Pomoc', top: 'more', sheet: 'account', icon: 'info' },
  { href: '/uwagi', label: 'Zgłoś uwagę', top: 'more', sheet: 'account', icon: 'edit' },
  { href: '/admin', label: 'Użytkownicy', badge: 'admin', admin: true, top: 'more', sheet: 'account', icon: 'shield' },
  { href: '/change-password', label: 'Zmień hasło', top: 'more', sheet: 'account', icon: 'key' },
];

// Grupy arkusza „Więcej” w kolejności wyświetlania
export const SHEET_GROUPS = [['journal', 'Dziennik'], ['discover', 'Odkrywaj'], ['social', 'Społeczność'], ['account', 'Konto']];

// place: 'bar' | 'main' | 'more' | 'sheet'
export function navItems(place, isAdmin) {
  return NAV_ITEMS.filter((i) => (!i.admin || isAdmin) && (place === 'bar' ? i.bar : place === 'sheet' ? i.sheet : i.top === place));
}
