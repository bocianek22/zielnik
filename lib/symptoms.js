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
