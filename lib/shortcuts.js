// Skróty aplikacji Android (POM-12, mobile/android/app/src/main/res/xml/shortcuts.xml) i tytuł raportu do druku.
// Czyste funkcje bez DOM: używane przez TodayPanel i PrintButton, sprawdzane w tests/shortcuts.test.js.

// Ścieżki otwierane przez skróty (wartość „path” w shortcuts.xml musi być jedną z nich)
export const SHORTCUT_PATHS = { use: '/?zuzylem=1', symptoms: '/#objawy', report: '/raport' };

// Ta sama reguła co SAFE_PATH w MainActivity.java: tylko ścieżka w obrębie aplikacji (bez „//host” i znaków spoza listy)
export const SAFE_PATH = /^\/(?!\/)[A-Za-z0-9/_?=&#.-]*$/;

// Co otworzyć w panelu „Dziś” po wejściu z adresu: 'use' (panel „Zużyłem”), 'symptoms' (karta objawów) albo null
export function shortcutAction(search = '', hash = '') {
  if (new URLSearchParams(search).get('zuzylem') === '1') return 'use';
  if (hash === '#objawy') return 'symptoms';
  return null;
}

// Adres bez parametru „zuzylem” (odświeżenie strony nie otwiera panelu ponownie); pozostałe parametry i kotwica zostają
export function withoutUseParam(pathname, search = '', hash = '') {
  const p = new URLSearchParams(search);
  p.delete('zuzylem');
  const q = p.toString();
  return `${pathname}${q ? `?${q}` : ''}${hash}`;
}

// Tytuł raportu dla lekarza: nazwa pliku PDF i zadania druku. W trybie dyskretnym neutralny, bo nazwę widać
// w powiadomieniu o druku, w Pobranych i przy udostępnianiu.
export const NEUTRAL_REPORT_TITLE = 'Raport';
export const reportTitle = (from, to, discreet = false) => (discreet ? NEUTRAL_REPORT_TITLE : `Raport dla lekarza ${from} – ${to}`);
