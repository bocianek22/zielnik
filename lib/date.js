// Wspólny format daty w interfejsie: „3 października 2026”.
// Zawsze w czasie polskim, żeby serwer (UTC) i telefon pokazały ten sam dzień. Napis bez strefy (sama data
// albo „RRRR-MM-DD GG:MM” z bazy, już w czasie polskim) dostaje południe UTC, które w Polsce jest tym samym dniem.
const OPTS = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Warsaw' };

export function formatDay(v) {
  if (v == null || v === '') return '–';
  const s = v instanceof Date ? v.toISOString() : String(v);
  const zoned = /(Z|[+-]\d{2}:?\d{2})$/.test(s) && !/^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z$/.test(s);
  const d = !zoned && /^\d{4}-\d{2}-\d{2}/.test(s) ? new Date(`${s.slice(0, 10)}T12:00:00Z`) : new Date(s);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('pl-PL', OPTS);
}

// Dzień „RRRR-MM-DD” w czasie polskim (POM-01). `toISOString().slice(0, 10)` daje dzień UTC, który od północy
// do 1:00 (zima) lub 2:00 (lato) jest jeszcze wczoraj. Działa tak samo w przeglądarce i na serwerze (UTC).
// Części składamy sami, bo układ napisu z Intl dla danego języka bywa różny między wersjami ICU.
const PL_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
export function isoPL(d) {
  const p = Object.fromEntries(PL_DAY.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const todayPL = (now = new Date()) => isoPL(now);
// przesunięcie dnia „RRRR-MM-DD” o n dni (rachunek w południe UTC, bez wpływu zmiany czasu)
export const addDaysIso = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
