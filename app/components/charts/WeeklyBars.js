'use client';
import SecHead from '../SecHead';
import { useState } from 'react';
import Frame from './Frame';
import Bars from './Bars';
import Scrub from './Scrub';
import { layoutLabels } from './labels';
import { niceTicks } from './scale';
import { num } from './fmt';

// Zużycie tygodniowe w Historii (8 tygodni). Gramy (susz) i ml (olej, pen) nigdy się nie sumują, więc przy wpisach w ml jest
// przełącznik jednostki jak w panelu „Dziś”. Liczba tylko przy najwyższym tygodniu, jedna linia siatki z podpisem, oś w HTML.
// Dotyk i strzałki przez Scrub (odczyt w nagłówku); wszystkie tygodnie są też w tabeli dla czytnika ekranu.
// `empty`: gotowy stan pusty ekranu (z ikoną i przyciskiem), pokazywany zamiast wykresu przy braku zużycia.
const UNIT_NAME = { g: 'Susz', ml: 'Olej i pen' };
const W = 326, H = 120, HMAX = 98; // 22 px nad najwyższym słupkiem zostaje na jego liczbę

export default function WeeklyBars({ weekly, empty }) {
  const hasMl = weekly.some((w) => w.ml > 0);
  const hasG = weekly.some((w) => w.grams > 0);
  const [pick, setPick] = useState(null);
  const [sel, setSel] = useState(null);
  const unit = pick ?? (hasMl && !hasG ? 'ml' : 'g');
  const val = (w) => (unit === 'ml' ? w.ml : w.grams) || 0;
  if (!hasG && !hasMl) return (<><h2 className="section-label">Zużycie tygodniowe, ostatnie {weekly.length} tygodni</h2>{empty}</>);

  const n = weekly.length;
  const max = Math.max(0, ...weekly.map(val));
  const total = weekly.reduce((a, w) => a + val(w), 0);
  const peak = max > 0 ? weekly.findIndex((w) => val(w) === max) : -1;
  const top = niceTicks(max, 3).at(-1);
  const grid = max > 0 ? niceTicks(max, 3).slice(1) : [];
  const slot = W / n, bw = Math.min(24, slot * 0.6);
  const yOf = (v) => H - (v / top) * HMAX;
  const i = sel == null ? null : Math.min(sel, n - 1);
  const name = unit === 'ml' ? 'olej i pen' : 'susz';
  // podpisy osi: co drugi tydzień licząc od bieżącego (na 320 px osiem podpisów DD.MM by się zderzyło)
  const ticks = layoutLabels(weekly.map((w, k) => ({ key: w.label, x: (k + 0.5) * slot, prio: k === n - 1 ? 2 : 1, text: w.label, strong: k === n - 1 }))
    .filter((t, k) => (n - 1 - k) % 2 === 0), W, { rows: 1 });
  const pct = (k) => `${((k + 0.5) / n) * 100}%`;

  return (
    <>
      <SecHead cat="stock" icon="chart">Zużycie tygodniowe, ostatnie {n} tygodni</SecHead>
      <Frame className="card wk" headClass="wk-head" readClass="wk-read"
        read={i == null
          ? <><span>średnio na tydzień</span> <b>{num(total / n, 1)} {unit}</b></>
          : <><span>tydzień od {weekly[i].label}</span> <b>{num(val(weekly[i]), 1)} {unit}</b></>}
        axis={(
          <div className="wk-axis" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t.key} className={`fc-lbl ${t.side}${t.strong ? ' strong' : ''}`} style={t.side === 'c' ? { left: `${(t.x / W) * 100}%` } : undefined}>{t.text}</span>
            ))}
          </div>
        )}
        table={(
          <table>
            <caption>Zużycie tygodniowe ({name}), ostatnie {n} tygodni</caption>
            <thead><tr><th scope="col">Tydzień od</th><th scope="col">Zużycie</th></tr></thead>
            <tbody>{weekly.map((w) => <tr key={w.label}><td>{w.label}</td><td>{num(val(w), 2)} {unit}</td></tr>)}</tbody>
          </table>
        )}>
        {hasMl && hasG && (
          <div className="seg wk-unit" role="group" aria-label="Jednostka wykresu">
            {['g', 'ml'].map((u) => (
              <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => { setPick(u); setSel(null); }}>{UNIT_NAME[u]} ({u})</button>
            ))}
          </div>
        )}
        {max === 0 ? (
          <p className="wk-none">W ostatnich {n} tygodniach nie zapisano zużycia ({name}).</p>
        ) : (
          <Scrub className="wk-scrub" n={n} sel={sel} onSel={setSel}
            label={`Zużycie tygodniowe, ${name}, ostatnie ${n} tygodni: razem ${num(total, 1)} ${unit}, najwięcej ${num(max, 1)} ${unit} w tygodniu od ${weekly[peak].label}. Strzałkami wybierzesz tydzień.`}>
            <Bars className="wk-svg" width={W} height={H} slot={slot} x0={(slot - bw) / 2} bw={bw} hmax={HMAX} minH={3} zeroH={2} max={top}
              preserveAspectRatio="none" aria-hidden="true" items={weekly.map((w) => ({ key: w.label, value: val(w) }))}
              groupClass={(d, k) => `ubar${k === i ? ' on' : ''}${k === n - 1 ? ' is-today' : ''}`} zeroClass="ubar-zero">
              {grid.map((t) => <line key={t} className="usage-grid" x1="0" x2={W} y1={yOf(t)} y2={yOf(t)} />)}
              <line className="usage-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
            </Bars>
            {grid.map((t) => {
              // podpis siatki po prawej; przy najwyższym słupku blisko prawej krawędzi ustępuje jego liczbie
              const clash = peak >= n - 2 && Math.abs(yOf(max) - yOf(t)) < 16;
              return !clash && <span key={t} className="usage-tick" style={{ top: yOf(t) }} aria-hidden="true">{num(t)} {unit}</span>;
            })}
            <span className="usage-peak" style={{ left: pct(peak), top: yOf(max) }} aria-hidden="true">{num(max, 1)}</span>
          </Scrub>
        )}
      </Frame>
    </>
  );
}
