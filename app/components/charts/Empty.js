// Stany wykresu. „brak danych”: jedno zdanie zamiast pustej siatki (kind="none", domyślnie).
// „mało danych”: wykres jest rysowany, ale nad nim stoi notka z minimum wpisów (kind="few", `min`), bez wygładzenia i pasma.
export default function Empty({ kind = 'none', min, className = '', children }) {
  if (kind === 'few') {
    return <p className={`chart-note${className ? ` ${className}` : ''}`}>{children ?? `Za mało wpisów, żeby pokazać trend (min. ${min}).`}</p>;
  }
  return <p className={className || undefined}>{children}</p>;
}
