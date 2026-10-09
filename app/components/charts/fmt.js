// Formatowanie dla wykresów. Daty to łańcuchy ISO (RRRR-MM-DD, dzień w czasie polskim z serwera), bez zegara przeglądarki
// i bez toLocaleDateString: ten sam wynik na serwerze i w telefonie (brak niezgodności hydratacji).

// Liczba po polsku (przecinek), do `max` miejsc po przecinku: 0,3 · 1,25 · 8,5
export const num = (x, max = 2) => Number(x).toLocaleString('pl-PL', { maximumFractionDigits: max });

// "2026-09-28" -> "28.09"
export const ddmm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
// "2026-10-09" -> "9 października"
export const longDay = (iso) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

const WEEKDAYS = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
// "2026-10-09" -> "pt."
export const weekday = (iso) => WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()];

// Przesunięcie dnia ISO o n dni (arytmetyka w UTC o 12:00, bez przesunięć strefy)
export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Polska odmiana: plural(n, 'dzień', 'dni', 'dni') -> 1 dzień, 2 dni, 5 dni. Trzy formy: 1, 2-4 (poza 12-14), reszta.
export function plural(n, one, few, many = few) {
  const a = Math.abs(n);
  if (a === 1) return one;
  const last = a % 10, tens = a % 100;
  return last >= 2 && last <= 4 && !(tens >= 12 && tens <= 14) ? few : many;
}
