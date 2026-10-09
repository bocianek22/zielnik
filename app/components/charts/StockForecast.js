import Frame from './Frame';
import { addDays, ddmm, longDay, num, plural } from './fmt';
import { linear } from './scale';
import { layoutLabels } from './labels';

// Prognoza zapasu jednej jednostki: linia spadku od dzisiejszego zapasu do zera przy średnim tempie, pasmo między tempem
// najwolniejszego i najszybszego tygodnia z ostatnich 4 (bez pasma przy < 14 dniach zapisów), data końca i, jeśli jest ważna
// recepta z resztą do wykupienia, pionowa kreska jej ważności. Bez ocen i zaleceń: podpis zawsze mówi „przy obecnym tempie zapisów”.
// Serwerowy komponent (bez stanu); SVG ma stałą wysokość w CSS razem z osią w HTML, więc nic nie skacze (CLS 0).
// stock, rate (średnio na dzień), range { minRate, maxRate } | null, today (ISO z serwera), rx { days_left, valid_until } | null.
const W = 326, H = 96, TOP = 8, BASE = 88;
const HORIZON = 30, MIN_SPAN = 7;

export default function StockForecast({ unit, stock, rate, range, today, rx, what = '' }) {
  if (!(stock > 0) || !(rate > 0)) return null;
  const hasBand = range && range.minRate != null && range.maxRate != null;
  // średnie tempo (30 dni) bywa poza zakresem tygodni: pasmo zawsze obejmuje linię
  const fast = hasBand ? Math.max(range.maxRate, rate) : rate;
  const slow = hasBand ? Math.min(range.minRate, rate) : rate;
  const dMean = stock / rate, dFast = stock / fast, dSlow = slow > 0 ? stock / slow : Infinity;
  const D = Math.min(HORIZON, Math.max(MIN_SPAN, Math.ceil(hasBand ? dSlow : dMean)));
  const x = linear([0, D], [0, W]);
  const y = linear([0, stock], [BASE, TOP]);
  const at = (d, r) => [x(d), y(Math.max(0, stock - r * d))];
  const pt = ([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`;

  const meanEnd = at(Math.min(dMean, D), rate);
  const band = hasBand && (() => {
    const p = [[0, TOP]];
    p.push(dFast < D ? [x(dFast), BASE] : at(D, fast));
    p.push(dSlow <= D ? [x(dSlow), BASE] : at(D, slow));
    return `M${p.map(pt).join('L')}Z`;
  })();

  const days = Math.floor(dMean);
  const endIso = addDays(today, days), fastIso = addDays(today, Math.floor(dFast));
  const slowIso = dSlow <= HORIZON ? addDays(today, Math.floor(dSlow)) : null;
  const dateOf = (iso) => longDay(iso);
  const rxLeft = rx && rx.days_left >= 0 && rx.days_left <= D ? rx.days_left : null;
  const bandText = hasBand && Math.floor(dFast) !== Math.floor(dSlow)
    ? (slowIso ? `${dateOf(fastIso)} – ${dateOf(slowIso)}` : `od ${dateOf(fastIso)}, w wolniejszym tygodniu dłużej niż ${HORIZON} ${plural(HORIZON, 'dzień', 'dni')}`) : null;

  // trzy podpisy, każdy w swoim rzędzie, gdy nachodzą na siebie (data końca i „dziś” mają pierwszeństwo)
  const labels = layoutLabels([
    { key: 'today', text: 'dziś', x: 0, prio: 3 },
    { key: 'end', text: `ok. ${ddmm(endIso)}`, x: dMean <= D ? x(dMean) : W, strong: true, prio: 2 },
    ...(rxLeft != null ? [{ key: 'rx', text: `${ddmm(rx.valid_until)} recepta`, x: x(rxLeft), prio: 1 }] : []),
  ], W);
  const rows = Math.max(...labels.map((l) => l.row)) + 1;

  const aria = `Prognoza zapasu${what && ` ${what}`}: ${num(stock)} ${unit}, przy obecnym tempie zapisów do ok. ${dateOf(endIso)}${bandText ? ` (zakres ${bandText})` : ''}`;
  return (
    <Frame className="forecast"
      table={(
        <ul>
          <li>Zapas dziś: {num(stock)} {unit}</li>
          <li>Przy obecnym tempie zapisów ({num(rate)} {unit} dziennie) starczy do ok. {dateOf(endIso)}</li>
          {bandText && <li>Zakres z ostatnich 4 tygodni: {bandText}</li>}
          {rxLeft != null && <li>Recepta z resztą do wykupienia ważna do {dateOf(rx.valid_until)}</li>}
        </ul>
      )}
      axis={(
        <>
          <div className="fc-axis" style={{ height: rows * 16 }} aria-hidden="true">
            {labels.map((l) => (
              <span key={l.key} className={`fc-lbl ${l.side}${l.strong ? ' strong' : ''}`} style={{ top: l.row * 16, ...(l.side === 'c' ? { left: `${(l.x / W) * 100}%` } : {}) }}>{l.text}</span>
            ))}
          </div>
          <p className="fc-note">
            Przy obecnym tempie zapisów.{' '}
            {!hasBand ? 'Zakres z ostatnich 4 tygodni pojawi się po 14 dniach z zapisami.'
              : bandText ? `Zakres z ostatnich 4 tygodni: ${bandText}.` : 'Zakres z ostatnich 4 tygodni jest zbliżony do średniej.'}
          </p>
        </>
      )}>
      <div className="fc-plot">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={aria}>
          <line className="fc-axisline" x1="0" x2={W} y1={BASE} y2={BASE} />
          {band && <path className="fc-band" d={band} />}
          {rxLeft != null && <line className="fc-rx" x1={x(rxLeft)} x2={x(rxLeft)} y1={TOP} y2={BASE} />}
          <line className="fc-line" x1="0" y1={TOP} x2={meanEnd[0]} y2={meanEnd[1]} />
        </svg>
        <i className="fc-dot" style={{ top: `${(TOP / H) * 100}%` }} aria-hidden="true" />
      </div>
    </Frame>
  );
}
