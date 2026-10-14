// Własne pomiary (POM-63): stałe i parsowanie wspólne dla serwera, klienta i importu kopii. Bez norm i ocen:
// granice wartości tylko chronią bazę, nie mówią nic o zdrowiu.
export const MEASURE_MAX = 3;
export const MEASURE_NAME_MAX = 40;
export const MEASURE_UNIT_MAX = 12;
export const MEASURE_MIN = -1000000;
export const MEASURE_LIMIT = 1000000;

// cięcie po punktach kodowych: emoji na granicy nie zostaje rozcięte (samotny surogat psuje JSON w imporcie kopii)
const clean = (v, max) => [...String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();
export const cleanMeasureName = (v) => clean(v, MEASURE_NAME_MAX);
export const cleanMeasureUnit = (v) => clean(v, MEASURE_UNIT_MAX);

// „72,5”, „72.5”, 72.5 -> 72.5; '' i null -> null; śmieci i wartości spoza granic -> NaN. Dwa miejsca po przecinku.
export function parseMeasure(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= MEASURE_MIN && v <= MEASURE_LIMIT ? Math.round(v * 100) / 100 : NaN;
  if (typeof v !== 'string') return NaN;
  const s = v.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  if (!/^-?(\d+(\.\d+)?|\.\d+)$/.test(s)) return NaN;
  const n = Number(s);
  return n >= MEASURE_MIN && n <= MEASURE_LIMIT ? Math.round(n * 100) / 100 : NaN;
}

export const fmtMeasure = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 });
