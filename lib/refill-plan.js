import { addDaysIso } from './date.js';

// Plan wykupu: kiedy najpóźniej iść do apteki i czy recepta na to pozwala. Czysty moduł (Dziś, Recepty, testy).
// Liczymy z zapasu i średniego tempa z 30 dni (jak prognoza na „Dziś”), osobno dla g i ml, bez sumowania jednostek.
// LEAD_DAYS dni zapasu: tyle zostawiamy na dojazd, brak leku w aptece albo weekend.
export const LEAD_DAYS = 5;
// Na „Dziś” plan pojawia się dopiero, gdy trzeba działać: wykup za ≤ DUE_DAYS dni albo brak recepty, a zapasu na ≤ NEED_RX_DAYS
export const DUE_DAYS = 3;
export const NEED_RX_DAYS = 21;

const diff = (a, b) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 864e5);

// unit: 'g' | 'ml'; stock i perDay w tej jednostce; rx: lista z prescriptionCountdown (unit, remaining, valid_until, days_left)
// -> null (brak tempa lub zapasu) albo { unit, daysLeft, runOut, buyBy, daysToBuy, status, rx, due }
// status: 'ok' (jest ważna recepta), 'rx-first' (recepta wygaśnie, zanim przyjdzie czas wykupu: kupić przed jej końcem),
// 'need-rx' (brak ważnej recepty z resztą do wykupienia: potrzebna nowa przed końcem zapasu)
export function refillPlan({ unit, stock, perDay, rx = [], today, lead = LEAD_DAYS }) {
  // bez zapasu nie ma czego planować (pusty zapas pokazuje „Kończy się zapas”); limit chroni przed datą poza zakresem
  if (!(perDay > 0) || !(stock > 0)) return null;
  const daysLeft = Math.min(Math.floor(stock / perDay), 3650);
  const runOut = addDaysIso(today, daysLeft);
  let buyBy = addDaysIso(today, Math.max(0, daysLeft - lead));
  const open = rx.filter((r) => (r.unit === 'ml' ? 'ml' : 'g') === unit && r.days_left >= 0 && r.remaining > 0)
    .sort((a, b) => a.days_left - b.days_left);
  // najpierw recepta ważna jeszcze w dniu wykupu (najbliższy termin); dopiero gdy takiej nie ma, ta, która wygaśnie wcześniej
  const covering = open.find((r) => r.valid_until >= buyBy);
  const best = covering || open[0] || null;
  let status = 'need-rx';
  if (best) {
    status = 'ok';
    if (!covering) { status = 'rx-first'; buyBy = best.valid_until; }
  }
  const daysToBuy = Math.max(0, diff(buyBy, today));
  const due = status === 'need-rx' ? daysLeft <= NEED_RX_DAYS : daysToBuy <= DUE_DAYS;
  return { unit, daysLeft, runOut, buyBy, daysToBuy, status, rx: best && { remaining: best.remaining, validUntil: best.valid_until }, due };
}
