// Wspólny format daty w interfejsie: „3 października 2026”.
// Sama data (RRRR-MM-DD) dostaje południe, żeby strefa czasowa nie przesunęła dnia; pełny znacznik czasu liczy się lokalnie.
const OPTS = { day: 'numeric', month: 'long', year: 'numeric' };

export function formatDay(v) {
  if (v == null || v === '') return '–';
  const s = v instanceof Date ? v.toISOString() : String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z?$/.test(s)
    ? new Date(`${s.slice(0, 10)}T12:00:00`)
    : new Date(s);
  return Number.isNaN(d.getTime()) ? '–' : d.toLocaleDateString('pl-PL', OPTS);
}
