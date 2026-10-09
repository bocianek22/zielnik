// Wymiary dziennika objawów: wspólne dla dziennika (/dziennik) i szybkiego wpisu w panelu „Dziś”.
// Kierunek skali jest różny: przy bólu i lęku wyżej = gorzej, przy śnie i nastroju wyżej = lepiej,
// dlatego każdy wymiar ma własne słowa na końcach skali.
export const SYMPTOMS = [
  { key: 'pain', label: 'Ból', short: 'ból', help: 'Jak silny był ból lub dyskomfort? 0 = brak, 10 = najgorszy możliwy.',
    low: 'brak', high: 'najgorszy' },
  { key: 'sleep', label: 'Jakość snu', short: 'sen', help: 'Jak spałeś ostatniej nocy? 0 = bardzo źle, 10 = doskonale.',
    low: 'bardzo źle', high: 'doskonale' },
  { key: 'anxiety', label: 'Lęk', short: 'lęk', help: 'Jak silny był lęk lub napięcie? 0 = brak, 10 = bardzo silny.',
    low: 'brak', high: 'bardzo silny' },
  { key: 'mood', label: 'Nastrój', short: 'nastrój', help: 'Jaki był Twój nastrój? 0 = bardzo zły, 10 = bardzo dobry.',
    low: 'bardzo zły', high: 'bardzo dobry' },
];

// Stopnie szybkiego wpisu (panel „Dziś”); pełna skala 0–10 zostaje w dzienniku
export const QUICK_STEPS = [0, 3, 5, 7, 10];

// Własne objawy (POM-07): do 3 na konto, skala 0-10, kierunek wybiera właściciel. Klucz w danych: `c<id>`.
export const CUSTOM_MAX = 3;
export const CUSTOM_NAME_MAX = 40;

// Czyszczenie nazwy: znaki sterujące i nadmiar odstępów usuwamy, długość do 40 znaków
export const cleanCustomName = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX);

// Opis własnego objawu w kształcie wbudowanego (SYMPTOMS): ten sam kod rysuje wykres i formularz
export function customMeta(def) {
  const better = !!(def.higherBetter ?? def.higher_better);
  return {
    key: `c${def.id}`, id: def.id, custom: true, label: def.name, short: def.name.toLowerCase(),
    help: `${def.name}: skala 0–10, wyżej = ${better ? 'lepiej' : 'gorzej'}.`,
    low: better ? 'gorzej' : 'lepiej', high: better ? 'lepiej' : 'gorzej',
  };
}
