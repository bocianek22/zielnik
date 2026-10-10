// Kalendarz zużycia: czyste funkcje (bez Reacta), testy w tests/calendar.test.js. Dni to łańcuchy ISO (czas polski z serwera).
import { addDays } from './fmt.js';

// Poniedziałek tygodnia, w którym leży dzień (tydzień kalendarza zaczyna się w poniedziałek)
export function weekStart(iso) {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = niedziela
  return addDays(iso, -((dow + 6) % 7));
}

// Kwartały (13 tygodni) liczone wstecz od tygodnia z `today`; zwraca od najstarszego do najnowszego.
// Kolumna = tydzień (pon..niedz); dni po `today` to null (komórka-wypełniacz, żeby siatka miała 7 wierszy).
export function quarters(today, count = 1) {
  const end = weekStart(today);
  const out = [];
  for (let q = count - 1; q >= 0; q--) {
    const first = addDays(end, -7 * (13 * (q + 1) - 1));
    const weeks = [];
    for (let w = 0; w < 13; w++) {
      const mon = addDays(first, 7 * w);
      weeks.push(Array.from({ length: 7 }, (_, d) => { const day = addDays(mon, d); return day > today ? null : day; }));
    }
    out.push({ first, weeks });
  }
  return out;
}

// Progi czterech poziomów skali sekwencyjnej: kwartyle dodatnich wartości z własnych danych (3 progi → poziomy 1..4).
export function thresholds(values) {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length === 0) return [];
  const at = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return [at(0.25), at(0.5), at(0.75)];
}
export const levelOf = (value, th) => 1 + th.filter((t) => value > t).length;

// Stan dnia w wybranej jednostce ('g' | 'ml'): none (brak wpisu), nouse (POM-38), use (zużycie) albo other (zużycie tylko w drugiej jednostce)
export function dayState(row, unit) {
  if (!row) return 'none';
  const v = unit === 'ml' ? row.ml : row.g;
  if (v > 0) return 'use';
  if (row.g > 0 || row.ml > 0) return 'other';
  return row.noUse ? 'nouse' : 'none';
}

// Pierwszy dzień miesiąca w tygodniu (kolumnie) -> podpis miesiąca nad kolumną
const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
export function monthLabels(weeks) {
  const out = [];
  weeks.forEach((w, i) => {
    const one = w.find((d) => d && d.endsWith('-01'));
    if (one) out.push({ col: i, text: one.slice(5, 7) === '01' ? `${MON[0]} ${one.slice(0, 4)}` : MON[Number(one.slice(5, 7)) - 1] });
  });
  return out;
}
