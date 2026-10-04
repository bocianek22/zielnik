// Wymiary dziennika objawów: wspólne dla dziennika (/dziennik) i szybkiego wpisu w panelu „Dziś”.
// Kierunek skali jest różny: przy bólu i lęku wyżej = gorzej, przy śnie i nastroju wyżej = lepiej,
// dlatego każdy wymiar ma własne słowa na końcach skali.
// Na wykresie linie różnią się nie tylko kolorem: kreską (dash) i kształtem punktu (marker).
export const SYMPTOMS = [
  { key: 'pain', label: 'Ból', short: 'ból', help: 'Jak silny był ból lub dyskomfort? 0 = brak, 10 = najgorszy możliwy.',
    low: 'brak', high: 'najgorszy', color: 'var(--chart-1)', dash: '', marker: 'circle' },
  { key: 'sleep', label: 'Jakość snu', short: 'sen', help: 'Jak spałeś ostatniej nocy? 0 = bardzo źle, 10 = doskonale.',
    low: 'bardzo źle', high: 'doskonale', color: 'var(--chart-2)', dash: '7 4', marker: 'square' },
  { key: 'anxiety', label: 'Lęk', short: 'lęk', help: 'Jak silny był lęk lub napięcie? 0 = brak, 10 = bardzo silny.',
    low: 'brak', high: 'bardzo silny', color: 'var(--chart-3)', dash: '2 3', marker: 'triangle' },
  { key: 'mood', label: 'Nastrój', short: 'nastrój', help: 'Jaki był Twój nastrój? 0 = bardzo zły, 10 = bardzo dobry.',
    low: 'bardzo zły', high: 'bardzo dobry', color: 'var(--chart-4)', dash: '9 3 2 3', marker: 'diamond' },
];

// Stopnie szybkiego wpisu (panel „Dziś”); pełna skala 0–10 zostaje w dzienniku
export const QUICK_STEPS = [0, 3, 5, 7, 10];

// Własne objawy (POM-07): do 3 na konto, skala 0-10, kierunek wybiera właściciel. Klucz w danych: `c<id>`.
export const CUSTOM_MAX = 3;
export const CUSTOM_NAME_MAX = 40;
const CUSTOM_STYLE = [
  { color: 'var(--chart-5)', dash: '5 2', marker: 'cross' },
  { color: 'var(--chart-6)', dash: '1 3', marker: 'ring' },
  { color: 'var(--chart-7)', dash: '12 4 2 4', marker: 'down' },
];

// Czyszczenie nazwy: znaki sterujące i nadmiar odstępów usuwamy, długość do 40 znaków
export const cleanCustomName = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX);

// Opis własnego objawu w kształcie wbudowanego (SYMPTOMS): ten sam kod rysuje wykres i formularz
export function customMeta(def) {
  const better = !!(def.higherBetter ?? def.higher_better);
  const st = CUSTOM_STYLE[((def.slot || 1) - 1) % CUSTOM_STYLE.length];
  return {
    key: `c${def.id}`, id: def.id, custom: true, label: def.name, short: def.name.toLowerCase(),
    help: `${def.name}: skala 0–10, wyżej = ${better ? 'lepiej' : 'gorzej'}.`,
    low: better ? 'gorzej' : 'lepiej', high: better ? 'lepiej' : 'gorzej', ...st,
  };
}
