// Zakres tempa zużycia do prognozy zapasu w panelu „Dziś” (czyste funkcje, bez bazy: tests/db/forecast.test.js).
// Daje najwolniejszy i najszybszy tydzień z ostatnich 4 (g lub ml na dzień); średnie tempo i `daysLeft` zostają w lib/widget.js.
export const MIN_DAYS = 14; // tyle dni z wpisami potrzeba, żeby pokazać zakres (mniej: sama linia)
const WEEKS = 4;

const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// rows: [{ day: 'RRRR-MM-DD', total }] dla jednej jednostki z ostatnich 28 dni; today: dzień z serwera (czas polski).
// Tydzień liczy się tylko w całości po pierwszym wpisie (niepełny tydzień zaniżałby tempo). Przy < MIN_DAYS dniach z wpisami
// albo bez dwóch pełnych tygodni minRate i maxRate to null.
export function rateRange(rows, today) {
  const sums = new Map();
  for (const r of rows) sums.set(r.day, (sums.get(r.day) || 0) + (Number(r.total) || 0));
  const days = sums.size;
  const none = { days, minRate: null, maxRate: null };
  if (days < MIN_DAYS) return none;
  const first = [...sums.keys()].sort()[0];
  const rates = [];
  // dzisiejszy dzień liczy się dopiero po wpisie; bez niego tydzień 0 byłby zaniżony o ok. 1/7 (zapytanie sięga 28 dni wstecz)
  const last = sums.has(today) ? today : addDays(today, -1);
  for (let k = 0; k < WEEKS; k++) {
    const end = addDays(last, -7 * k), start = addDays(end, -6);
    if (start < first) break;
    let total = 0;
    for (const [day, v] of sums) if (day >= start && day <= end) total += v;
    rates.push(total / 7);
  }
  return rates.length < 2 ? none : { days, minRate: Math.min(...rates), maxRate: Math.max(...rates) };
}
