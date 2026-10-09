import Frame from './Frame';
import Bars from './Bars';
import { num } from './fmt';

// Zużycie tygodniowe w Historii: gramy suszu; ml (olej, pen) osobną serią tylko gdy są wpisy w ml.
// `empty`: gotowy stan pusty ekranu (z ikoną i przyciskiem), pokazywany zamiast wykresu przy braku zużycia.
export default function WeeklyBars({ weekly, empty }) {
  const hasMl = weekly.some((w) => w.ml > 0);
  const unit = hasMl && !weekly.some((w) => w.grams > 0) ? 'ml' : 'g';
  const val = (w) => (unit === 'ml' ? w.ml : w.grams);
  const none = weekly.every((w) => w.grams === 0 && !(w.ml > 0));
  const max = Math.max(1, ...weekly.map(val));
  const total = weekly.reduce((a, w) => a + val(w), 0);
  const peak = weekly.reduce((a, w) => (val(w) > val(a) ? w : a), weekly[0] || { grams: 0, ml: 0, label: '' });
  const label = `Zużycie tygodniowe w ${unit === 'ml' ? 'mililitrach' : 'gramach'}, ostatnie ${weekly.length} tygodni: razem ${num(total, 1)} ${unit}, najwięcej ${num(val(peak), 1)} ${unit} w tygodniu od ${peak.label}.`;
  const mlWeeks = unit === 'g' && hasMl ? weekly.filter((w) => w.ml > 0) : [];

  return (
    <>
      <h2 className="section-label">Zużycie tygodniowe, ostatnie {weekly.length} tygodni{hasMl && (unit === 'ml' ? ' (olej i pen, ml)' : ' (susz, g)')}</h2>
      {none ? empty : (
        <Frame className="card usage-chart">
          <Bars className="bars" width={400} height={160} base={130} slot={47} x0={12} bw={34} hmax={100} max={max} role="img" aria-label={label}
            items={weekly.map((w) => ({ key: w.label, value: val(w) }))} pathClass="bar"
            extra={(w, i, { x, y }) => (
              <>
                <text className="val" x={x + 17} y={y - 6} textAnchor="middle">{w.value ? num(w.value, 1) : ''}</text>
                <text className="tick" x={x + 17} y={148} textAnchor="middle">{weekly[i].label}</text>
              </>
            )}>
            <line className="axis" x1="6" x2="394" y1="130" y2="130" />
          </Bars>
        </Frame>
      )}
      {mlWeeks.length > 0 && (
        <p className="muted small">Olej i pen (ml, osobno od suszu): {mlWeeks.map((w) => `tydzień od ${w.label}: ${num(w.ml, 1)} ml`).join(', ')}.</p>
      )}
    </>
  );
}
