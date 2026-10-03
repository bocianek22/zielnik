// Liczby wpisywane na telefonie: klawiatura z przecinkiem daje "0,5", a type="number" potrafi je zgubić.
// Pola ilości to type="text" inputMode="decimal"; wartość zamieniamy tym parserem.
export const NUM_PATTERN = '[0-9]*[.,]?[0-9]*';

// "0,5" / "1.5" / " 2 " -> liczba; puste -> null; śmieci (np. "abc", "1,2,3", "-1") -> NaN
export function parseNum(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : NaN;
  if (s == null) return null;
  const t = String(s).replace(/[\s ]/g, '').replace(',', '.');
  if (t === '') return null;
  if (!/^(\d+\.?\d*|\.\d+)$/.test(t)) return NaN;
  return Number(t);
}

// atrybuty wspólne dla pól dziesiętnych
export const decimalProps = { type: 'text', inputMode: 'decimal', pattern: NUM_PATTERN, autoComplete: 'off' };
