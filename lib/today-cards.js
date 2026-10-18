// Karty panelu „Dziś” (POM-48, UI 5 etap 3): kolejność i ukrywanie, gotowe układy. „Plan na dziś” (dawne „Do zrobienia”,
// w tym recepta wygasająca) zostaje zawsze, więc pilne informacje nie znikają. Czysty moduł: klient, serwer i testy.
export const TODAY_CARDS = [
  { key: 'plan', label: 'Plan na dziś', fixed: true },
  { key: 'tiles', label: 'Kafle: recepta, nastrój, zużycie' },
  { key: 'symptoms', label: 'Szybki wpis objawów' },
  { key: 'chart', label: 'Wykres 14 dni i prognoza zapasu' },
  { key: 'rx', label: 'Lista recept' },
  { key: 'streak', label: 'Twój tydzień: regularność i odznaki' },
];
const ALL = TODAY_CARDS.map((c) => c.key);
const HIDEABLE = new Set(TODAY_CARDS.filter((c) => !c.fixed).map((c) => c.key));
export const DEFAULT_ORDER = ALL;

// Gotowe układy (wybór właściciela, docs/UI-5.md); „Własny” = każda inna kombinacja
export const PRESETS = [
  { key: 'pelny', label: 'Pełny', sub: 'Wszystko, plan dnia na górze', order: ALL, hidden: [] },
  { key: 'objawy', label: 'Objawy najpierw', sub: 'Szybki wpis samopoczucia na górze', order: ['symptoms', 'plan', 'tiles', 'chart', 'rx', 'streak'], hidden: [] },
  { key: 'zapas', label: 'Zapas najpierw', sub: 'Zapas, wykres i recepty na górze', order: ['tiles', 'chart', 'rx', 'plan', 'symptoms', 'streak'], hidden: [] },
  { key: 'minimalny', label: 'Minimalny', sub: 'Tylko plan dnia i szybki wpis', order: ['plan', 'symptoms', 'tiles', 'chart', 'rx', 'streak'], hidden: ['tiles', 'chart', 'rx', 'streak'] },
];

const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',')).map((x) => String(x).trim());

// Napis z bazy albo tablica od klienta -> lista znanych kluczy do ukrycia, bez powtórzeń („plan” nie do ukrycia)
export function parseHidden(v) {
  return [...new Set(list(v).filter((x) => HIDEABLE.has(x)))];
}

// Kolejność: znane klucze w podanej kolejności, brakujące dopisane na końcu w kolejności domyślnej
export function parseOrder(v) {
  const known = [...new Set(list(v).filter((x) => ALL.includes(x)))];
  return [...known, ...ALL.filter((k) => !known.includes(k))];
}

const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
// Który gotowy układ odpowiada zapisanym ustawieniom (null = własny)
export function presetOf(order, hidden) {
  const o = parseOrder(order), h = [...parseHidden(hidden)].sort();
  return PRESETS.find((p) => same(o, p.order) && same(h, [...p.hidden].sort()))?.key ?? null;
}

// Przesunięcie karty o jedno miejsce (dir -1 w górę, 1 w dół); poza zakresem bez zmian
export function moveCard(order, key, dir) {
  const o = parseOrder(order);
  const i = o.indexOf(key), j = i + dir;
  if (i < 0 || j < 0 || j >= o.length) return o;
  [o[i], o[j]] = [o[j], o[i]];
  return o;
}
