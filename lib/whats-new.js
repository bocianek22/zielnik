// „Co nowego”: krótka lista zmian prostym językiem, najnowsza wersja pierwsza. Bez żargonu i bez słów zdradzających
// temat aplikacji (tryb dyskretny: tekst widać na ekranie, który ktoś może zobaczyć). Przy każdym wydaniu dopisz wpis
// (tests/whats-new.test.js pilnuje wpisu dla wersji z package.json).
export const WHATS_NEW = [
  { version: '0.49.1', items: [
    'Poprawki wyglądu na iPhonie (pola dat, pełna wysokość ekranu) i wygodniejsze logowanie bez automatycznej wielkiej litery.',
  ] },
  { version: '0.49.0', items: [
    'Wersja testowa: w menu „Więcej” jest „Zgłoś uwagę” i „Pomoc”, a status swoich zgłoszeń zobaczysz na liście.',
    'Nowy regulamin wersji testowej i polityka prywatności: przy pierwszym wejściu poprosimy o ich akceptację.',
    'Na Androidzie możesz dodać widżet na ekran główny: ile dni starczy zapasu i szybki zapis.',
  ] },
  { version: '0.48.0', items: [
    'Zakup można przypisać do recepty. Aplikacja sama podpowiada pasującą, a w Historii zmienisz wybór.',
    'Nowe konto zaczyna od krótkiego kreatora: trzy kroki, każdy można pominąć.',
    'Puste ekrany podpowiadają, co zrobić jako pierwsze.',
  ] },
  { version: '0.47.0', items: [
    'Odzyskasz hasło e-mailem, jeśli podasz i potwierdzisz adres w profilu.',
    'Przypomnienia: wieczorem o wpisie z samopoczuciem i dzień przed wizytą u lekarza. Domyślnie wyłączone, włączysz je w profilu.',
  ] },
  { version: '0.46.0', items: [
    'Możesz zaproponować poprawkę w opisie pozycji z katalogu. Administrator ją sprawdzi.',
    'Opcja „Większy tekst i przyciski” w profilu oraz lepsza obsługa z klawiatury i czytnikiem ekranu.',
  ] },
  { version: '0.45.0', items: [
    'Lista otwiera się szybciej, także przy dużej liczbie pozycji.',
    'Nowa ikona karty w przeglądarce.',
  ] },
  { version: '0.44.0', items: [
    'Przy każdej pozycji widać Twoje statystyki: ile łącznie, średnio dziennie i kiedy ostatnio.',
  ] },
];

const parts = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);

// -1, 0, 1 jak w sort(): numery wersji porównywane liczbowo (0.9.0 < 0.10.0)
export function compareVersions(a, b) {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  return 0;
}

// Wpisy nowsze niż ostatnio widziana wersja (i nie nowsze od bieżącej)
export function newerThan(seen, current) {
  return WHATS_NEW.filter((e) => compareVersions(e.version, seen) > 0 && compareVersions(e.version, current) <= 0);
}
