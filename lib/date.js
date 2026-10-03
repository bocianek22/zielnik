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
