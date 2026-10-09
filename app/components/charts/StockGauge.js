import { plural } from './fmt';

// Miernik zapasu w dniach względem `horizon` (domyślnie 30), podziałka co 7 i 14 dni. Bez prognozy (daysLeft == null) pusty pasek.
// Kolor wypełnienia (akcent albo ostrzeżenie) wybiera CSS po klasie karty `.today-card.warn`.
const MARKS = [7, 14];

export default function StockGauge({ daysLeft, horizon = 30, what = '' }) {
  if (daysLeft == null) return <div className="gauge empty" aria-hidden="true" />;
  const word = plural(daysLeft, 'dzień', 'dni');
  const pct = Math.min(daysLeft / horizon, 1) * 100;
  return (
    <>
      <div className="gauge" role="meter" aria-label={`Zapas${what && ` ${what}`} w dniach (pełny pasek: ${horizon} dni)`} aria-valuemin={0} aria-valuemax={horizon}
        aria-valuenow={Math.min(daysLeft, horizon)} aria-valuetext={`${daysLeft} ${word}`}>
        <span style={{ width: `${pct}%` }} />
        {MARKS.map((m) => <i key={m} style={{ left: `${(m / horizon) * 100}%` }} />)}
      </div>
      <div className="gauge-scale" aria-hidden="true">
        <span>0</span>
        {MARKS.map((m) => <span key={m} className="mid" style={{ left: `${(m / horizon) * 100}%` }}>{m}</span>)}
        <span className="end">{horizon} dni</span>
      </div>
    </>
  );
}
