'use client';
import { useState } from 'react';
import Frame from './Frame';
import Scrub from './Scrub';
import { addDays, ddmm, longDay, num } from './fmt';
import { measurePoints, measureScale } from '@/lib/measure-chart';

// Wykres własnego pomiaru z 30 dni (POM-63): jedna seria i własna oś Y (bez zera, zakres wartości), bez norm i kolorów ocen.
// Linia łączy kolejne pomiary (pomiary bywają rzadkie, np. waga raz w tygodniu), kropki to dni z pomiarem. Dotyk, mysz
// i strzałki wybierają dzień (Scrub), odczyt jest w nagłówku; tabela dla czytnika ekranu w Frame.
const N = 30, H = 80;
const pct = (i) => ((i + 0.5) / N) * 100;

export default function MeasureChart({ def, values, today }) {
  const [sel, setSel] = useState(null);
  const days = Array.from({ length: N }, (_, k) => addDays(today, k - (N - 1)));
  const pts = measurePoints(days, values, def.id);
  const scale = measureScale(pts.map((p) => p.value));
  if (!scale || pts.length < 2) return null;
  const y = (v) => (1 - (v - scale.lo) / (scale.hi - scale.lo)) * 100;
  const unit = def.unit ? ` ${def.unit}` : '';
  const last = pts.at(-1);
  const at = sel != null ? pts.find((p) => p.i === sel) : null;
  const read = sel == null
    ? <>ostatni <b>{num(last.value)}{unit}</b>, {longDay(last.day)}</>
    : at ? <>{longDay(at.day)}: <b>{num(at.value)}{unit}</b></> : <>{longDay(days[sel])}: brak pomiaru</>;
  const line = pts.map((p, k) => `${k ? 'L' : 'M'}${pct(p.i).toFixed(2)},${y(p.value).toFixed(2)}`).join('');
  return (
    <Frame className="ms-chart" headClass="sp-head" title={<><span className="dn">{def.name}</span>{def.unit && <span className="ms-unit"> ({def.unit})</span>}</>}
      titleClass="ms-title" read={read} readClass="sp-read ms-read"
      axis={<div className="sp-axis" aria-hidden="true"><span className="sp-lbl" style={{ left: 0 }}>{ddmm(days[0])}</span><span className="sp-lbl" style={{ right: 0 }}>dziś</span></div>}
      table={<table><caption>{def.name} z ostatnich 30 dni</caption><thead><tr><th>Dzień</th><th>Wartość</th></tr></thead>
        <tbody>{pts.map((p) => <tr key={p.day}><td>{longDay(p.day)}</td><td>{num(p.value)}{unit}</td></tr>)}</tbody></table>}>
      <Scrub n={N} sel={sel} onSel={setSel} className="sp-scrub ms-scrub" label={`${def.name}: wykres z 30 dni, strzałki wybierają dzień`}>
        <div className="ms-plot">
          {scale.ticks.map((t) => <span key={t} className="ms-tick" style={{ top: `${y(t)}%` }} aria-hidden="true">{num(t)}</span>)}
          <svg viewBox={`0 0 100 ${100}`} preserveAspectRatio="none" aria-hidden="true" style={{ height: H }}>
            {scale.ticks.map((t) => <line key={t} className="sp-grid" x1="0" x2="100" y1={y(t)} y2={y(t)} />)}
            {sel != null && <line className="sp-cross" x1={pct(sel)} x2={pct(sel)} y1="0" y2="100" />}
            <path className="sp-line ms-line" d={line} />
          </svg>
          {pts.map((p) => <span key={p.day} className={`sp-end ms-dot${sel === p.i ? ' on' : ''}`} style={{ left: `${pct(p.i)}%`, top: `${y(p.value)}%` }} aria-hidden="true" />)}
        </div>
      </Scrub>
    </Frame>
  );
}
