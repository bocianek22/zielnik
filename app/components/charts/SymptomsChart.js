import { Marker } from './Marker';
import { addDays, ddmm, longDay, num } from './fmt';

// Wykres objawów z 30 dni (jedna skala 0-10) ze słupkami zużycia suszu pod spodem. Klasa `sym-chart` jest używana przez E2E.
export default function SymptomsChart({ rows, usage, all, end }) {
  const days = 30, W = 360, H = 200, L = 24, B = 24, T = 8, R = 8;
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r])), use = Object.fromEntries(usage.map((u) => [u.day, u.grams]));
  const useMl = Object.fromEntries(usage.map((u) => [u.day, u.ml || 0])); // olej i pen: tylko w tabeli, słupki pokazują gramy suszu
  const xs = Array.from({ length: days }, (_, i) => addDays(end, -(days - 1 - i)));
  const x = (i) => L + (i * (W - L - R)) / (days - 1);
  const y = (v) => T + (H - T - B) * (1 - v / 10);
  const maxU = Math.max(1, ...Object.values(use));
  const summary = all.map(({ key: k, label }) => {
    const vals = xs.map((d) => byDay[d]?.[k]).filter((v) => v != null);
    return vals.length ? `${label}: średnio ${num(vals.reduce((a, v) => a + v, 0) / vals.length, 1)} z ${vals.length} wpisów` : `${label}: brak wpisów`;
  }).join('. ');
  const listed = xs.filter((d) => byDay[d] || use[d] || useMl[d]).reverse();
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="sym-chart" role="img" aria-label={`Wykres objawów z ostatnich 30 dni, skala 0–10. ${summary}. Wartości z każdego dnia są w tabeli pod wykresem.`}>
        {[0, 5, 10].map((v) => <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
        {xs.map((d, i) => { if (!use[d]) return null; const h = ((use[d] / maxU) * (H - T - B)) * 0.5; return <rect key={d} className="use" x={x(i) - 2} y={y(0) - h} width="4" height={h} />; })}
        {all.map(({ key: k, color, dash, marker }) => {
          const pts = xs.map((d, i) => (byDay[d]?.[k] != null ? [x(i), y(byDay[d][k])] : null));
          const segs = []; let cur = [];
          pts.forEach((p) => { if (p) cur.push(p.join(',')); else if (cur.length) { segs.push(cur); cur = []; } });
          if (cur.length) segs.push(cur);
          return <g key={k}>{segs.map((sg, i) => <polyline key={i} points={sg.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeDasharray={dash || undefined} />)}
            {pts.map((p, i) => p && <Marker key={i} shape={marker} x={p[0]} y={p[1]} color={color} />)}</g>;
        })}
        {[0, 10, 20, 29].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor={i === 29 ? 'end' : 'middle'}>{ddmm(xs[i])}</text>)}
      </svg>
      {/* dane wykresu dla czytnika ekranu (jak lista w wykresie zużycia w panelu „Dziś”) */}
      {/* tabela w opakowaniu: sama tabela z .sr-only nie zwęża się do 1 px i poszerza stronę */}
      <div className="sr-only"><table>
        <caption>Wpisy objawów i zużycie z ostatnich 30 dni, od najnowszego</caption>
        <thead><tr><th scope="col">Dzień</th>{all.map((s) => <th key={s.key} scope="col">{s.label} (0–10)</th>)}<th scope="col">Zużycie</th></tr></thead>
        <tbody>
          {listed.length === 0 && <tr><td colSpan={all.length + 2}>Brak wpisów w ostatnich 30 dniach.</td></tr>}
          {listed.map((d) => (
            <tr key={d}><th scope="row">{d === end ? 'dziś' : longDay(d)}</th>
              {all.map((s) => <td key={s.key}>{byDay[d]?.[s.key] ?? 'nie wpisano'}</td>)}
              <td>{[use[d] > 0 && `${num(use[d], 1)} g`, useMl[d] > 0 && `${num(useMl[d], 1)} ml`].filter(Boolean).join(', ') || 'brak'}</td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}
