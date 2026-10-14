// Karty panelu „Dziś”, które można ukryć (POM-48). Kafle, „Do zrobienia” (w tym recepta wygasająca) i ustawienia
// zostają zawsze, więc pilne informacje nie znikają. Czysty moduł: klient, serwer i testy.
export const TODAY_CARDS = [
  { key: 'chart', label: 'Wykres 14 dni i prognoza zapasu' },
  { key: 'symptoms', label: 'Szybki wpis objawów' },
  { key: 'streak', label: 'Regularność wpisów' },
  { key: 'rx', label: 'Lista recept' },
];
const KEYS = new Set(TODAY_CARDS.map((c) => c.key));

// Napis z bazy albo tablica od klienta -> lista znanych kluczy bez powtórzeń
export function parseHidden(v) {
  const list = Array.isArray(v) ? v : String(v ?? '').split(',');
  return [...new Set(list.map((x) => String(x).trim()).filter((x) => KEYS.has(x)))];
}
