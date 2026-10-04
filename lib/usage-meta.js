// POM-03: sposób i pora przyjęcia przy „Zużyłem”. Oba pola są opcjonalne; opis, bez ocen.
export const METHODS = { vaporizer: 'waporyzator', oil: 'olej (doustnie)', other: 'inne' };
export const PERIODS = { morning: 'rano', day: 'w ciągu dnia', evening: 'wieczorem', night: 'w nocy' };
export const methodLabel = (m) => METHODS[m] || null;
export const periodLabel = (p) => PERIODS[p] || null;

// Sposób podpowiadany z postaci odmiany (zmiana w panelu jednym wyborem)
export const defaultMethod = (form) => (form === 'olej' ? 'oil' : 'vaporizer');

// Wartość z treści żądania: undefined = brak pola (bez zmiany), null = wyczyszczone, tekst = poprawny klucz, false = błąd
export function parseChoice(v, set) {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  return typeof v === 'string' && Object.hasOwn(set, v) ? v : false;
}
