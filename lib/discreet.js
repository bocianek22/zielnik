// Tryb dyskretny: ustawienie per urządzenie (localStorage + ciasteczko, żeby serwer renderował bez mignięcia).
// Ciasteczko nie jest daną wrażliwą: mówi tylko, że to urządzenie ma ukrywać nazwy.
export const DISCREET_KEY = 'zielnik.discreet';
export const DISCREET_COOKIE = 'zielnik_discreet';
export const DISCREET_TITLE = 'Notatnik';
export const REVEAL_MS = 5000;

export const isDiscreet = () => typeof document !== 'undefined' && document.documentElement.dataset.discreet === '1';

export function setDiscreet(on) {
  const el = document.documentElement;
  if (on) el.dataset.discreet = '1'; else delete el.dataset.discreet;
  try { on ? localStorage.setItem(DISCREET_KEY, '1') : localStorage.removeItem(DISCREET_KEY); } catch {}
  document.cookie = on
    ? `${DISCREET_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`
    : `${DISCREET_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  document.title = on ? DISCREET_TITLE : 'Zielnik';
  window.dispatchEvent(new Event('zielnik:discreet'));
}

// POM-60: tryb dyskretny włączany sam przy wyjściu z aplikacji (karta w tle, przełącznik aplikacji), per urządzenie.
// Włączamy przy ukryciu, nie przy powrocie: podgląd w przełączniku i pierwszy kadr po powrocie są już rozmyte.
export const DISCREET_AUTO_KEY = 'zielnik.discreet.auto';
export const discreetAuto = () => { try { return localStorage.getItem(DISCREET_AUTO_KEY) === '1'; } catch { return false; } };
export function setDiscreetAuto(on) {
  try { on ? localStorage.setItem(DISCREET_AUTO_KEY, '1') : localStorage.removeItem(DISCREET_AUTO_KEY); } catch {}
}
// czysta decyzja (testy): ukrywamy, gdy opcja włączona, strona schodzi do tła, a tryb jeszcze nie działa
export const hideOnLeave = ({ auto, visibility, discreet }) => auto && visibility === 'hidden' && !discreet;
