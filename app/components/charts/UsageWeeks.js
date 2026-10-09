'use client';
import { useState } from 'react';
import Frame from './Frame';
import Scrub from './Scrub';
import Empty from './Empty';
import { ddmm, num } from './fmt';

// Zużycie tygodniowe jako słupki (inline SVG, długości w procentach, więc zaokrąglenia nie rozciągają się na wąskim ekranie).
// Przesunięcie palcem lub strzałki pokazują wartość tygodnia; pełne dane są też w ukrytej tabeli dla czytników ekranu.
// unit: 'g' (susz) albo 'ml' (olej, pen) - wykres dotyczy jednej odmiany, więc jednej jednostki
export default function UsageWeeks({ weeks, unit = 'g' }) {
  const g = (n) => `${num(n)} ${unit}`;
  const [sel, setSel] = useState(null);
  const max = Math.max(...weeks.map((w) => w.grams));
  const n = weeks.length;
  const total = weeks.reduce((a, w) => a + w.grams, 0);
  const active = weeks.filter((w) => w.grams > 0).length;
  const shown = sel == null ? null : weeks[sel];
  // wysokość w procentach obszaru wykresu (zostawiamy 8% luzu nad najwyższym słupkiem)
  const h = (v) => (max > 0 ? (v / max) * 92 : 0);
  const slot = 100 / n;

  const plot = (
    <>
      <Scrub className="uchart-plot" n={n} sel={sel} onSel={setSel}
        label={`Zużycie w ostatnich ${n} tygodniach: razem ${g(total)}, najwięcej ${g(max)} w jednym tygodniu, użycie w ${active} z ${n} tygodni. Strzałki pokazują poszczególne tygodnie.`}>
        <svg width="100%" height="100%" aria-hidden="true" focusable="false">
          <line className="uchart-base" x1="0" x2="100%" y1="100%" y2="100%" />
          <line className="uchart-grid" x1="0" x2="100%" y1="8%" y2="8%" />
          {weeks.map((w, i) => {
            const bh = h(w.grams);
            if (!bh) return null;
            const x = `${i * slot + slot * 0.18}%`;
            const wd = `${slot * 0.64}%`;
            return (
              <g key={w.week} className={`uchart-bar${sel == null || sel === i ? '' : ' dim'}`}>
                <rect x={x} width={wd} y={`${100 - bh}%`} height={`${bh}%`} rx="3" />
                {/* dolna część bez zaokrąglenia: słupek stoi płasko na osi */}
                <rect x={x} width={wd} y={`${100 - Math.min(bh, 3)}%`} height={`${Math.min(bh, 3)}%`} />
              </g>
            );
          })}
        </svg>
        <span className="uchart-max" aria-hidden="true">{g(max)}</span>
      </Scrub>
      <div className="uchart-x" aria-hidden="true">
        {weeks.map((w, i) => <span key={w.week}>{i % 3 === 0 ? ddmm(w.week) : i === n - 1 ? 'teraz' : ''}</span>)}
      </div>
    </>
  );

  return (
    <Frame className="uchart" headClass="uchart-head" title="Zużycie tygodniowe" titleClass="dlabel" readClass="uchart-read"
      read={shown ? <><b>{g(shown.grams)}</b> <span>tydzień od {ddmm(shown.week)}</span></> : <><b>{g(total / n)}</b> <span>średnio na tydzień</span></>}
      table={max === 0 ? null : (
        <table>
          <caption>Zużycie tygodniowe, ostatnie {n} tygodni</caption>
          <thead><tr><th scope="col">Tydzień od</th><th scope="col">Zużycie</th></tr></thead>
          <tbody>{weeks.map((w) => <tr key={w.week}><td>{ddmm(w.week)}</td><td>{g(w.grams)}</td></tr>)}</tbody>
        </table>
      )}>
      {max === 0 ? <Empty className="muted">Brak zużycia w ostatnich 12 tygodniach.</Empty> : plot}
    </Frame>
  );
}
