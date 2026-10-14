// Czynniki dnia (POM-47): stałe i czyszczenie nazwy bez zależności od bazy (import kopii, klient, testy jednostkowe)
export const FACTOR_MAX = 8;
export const FACTOR_NAME_MAX = 30;
export const FACTOR_HINTS = ['stres', 'ruch', 'kofeina', 'alkohol', 'praca do późna', 'spacer', 'zła pogoda', 'podróż'];
export const cleanFactorName = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FACTOR_NAME_MAX);
