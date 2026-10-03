// Korekty wpisów zużycia i wykupu w Historii: wspólna walidacja. Korekt pacjentów nie zapisujemy w audit_log (dane zdrowotne, dziennik widzi admin).
import { parseNumber } from './strains';
import { todayPL } from './date';

export const MAX_COST = 10000000; // zł; purchases.cost to NUMERIC(10,2), więc większy koszt to błąd zamiast 500

// Dzień „RRRR-MM-DD” z formularza: null = bez zmiany, undefined = błędny (także z przyszłości w czasie polskim)
export function parseDay(v) {
  if (v == null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const d = new Date(`${v}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return undefined; // np. 2026-02-30
  return v >= '2000-01-01' && v <= todayPL() ? v : undefined;
}

// Pola korekty; zwraca { error } albo { grams, day, costMode, costValue } (null = bez zmiany)
export function parseCorrection(b, { maxGrams, purchase }) {
  const grams = parseNumber(b.grams, 0.01, maxGrams);
  if (Number.isNaN(grams)) return { error: `Podaj ilość (g lub ml, 0,01–${maxGrams}).` };
  const day = parseDay(b.date);
  if (day === undefined) return { error: 'Podaj datę nie późniejszą niż dziś.' };
  let costMode = null, costValue = null;
  if (purchase) {
    const price = parseNumber(b.pricePerG, 0, 10000);
    const cost = parseNumber(b.cost, 0, MAX_COST);
    if (Number.isNaN(price)) return { error: 'Cena za gram lub ml musi być liczbą od 0 do 10000.' };
    if (Number.isNaN(cost)) return { error: 'Koszt musi być liczbą od 0 do 10 000 000 zł.' };
    if (price != null && cost != null) return { error: 'Podaj cenę jednostkową albo łączny koszt, nie oba.' };
    if (price != null) { costMode = 'price'; costValue = price; }
    if (cost != null) { costMode = 'cost'; costValue = cost; }
  }
  if (grams == null && day == null && costMode == null) return { error: 'Nic do zmiany.' };
  return { grams, day, costMode, costValue };
}

