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
