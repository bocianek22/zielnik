'use client';
import { useState } from 'react';

const g = (n) => `${Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 2 })} g`;
const ddmm = (iso) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`; // "2026-09-28" -> "28.09", bez Date: ten sam wynik na serwerze i w telefonie

// Zużycie tygodniowe jako słupki (inline SVG, długości w procentach, więc zaokrąglenia nie rozciągają się na wąskim ekranie).
// Przesunięcie palcem lub strzałki pokazują wartość tygodnia; pełne dane są też w ukrytej tabeli dla czytników ekranu.
export default function UsageChart({ weeks }) {
  const [sel, setSel] = useState(null);
  const max = Math.max(...weeks.map((w) => w.grams));
  const n = weeks.length;
  const total = weeks.reduce((a, w) => a + w.grams, 0);
  const active = weeks.filter((w) => w.grams > 0).length;
  const shown = sel == null ? null : weeks[sel];
  const pick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setSel(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setSel((s) => Math.min(n - 1, Math.max(0, (s ?? n) + (e.key === 'ArrowLeft' ? -1 : 1))));
    } else if (e.key === 'Escape') setSel(null);
  };
  // wysokość w procentach obszaru wykresu (zostawiamy 8% luzu nad najwyższym słupkiem)
  const h = (v) => (max > 0 ? (v / max) * 92 : 0);
  const slot = 100 / n;

  return (
    <div className="uchart">
      <div className="uchart-head">
        <h3 className="dlabel">Zużycie tygodniowe</h3>
        <p className="uchart-read" aria-live="polite">
          {shown
            ? <><b>{g(shown.grams)}</b> <span>tydzień od {ddmm(shown.week)}</span></>
            : <><b>{g(total / n)}</b> <span>średnio na tydzień</span></>}
        </p>
      </div>
      {max === 0 ? (
        <p className="muted">Brak zużycia w ostatnich 12 tygodniach.</p>
      ) : (
        <>
          <div className="uchart-plot" tabIndex={0} role="img"
            aria-label={`Zużycie w ostatnich ${n} tygodniach: razem ${g(total)}, najwięcej ${g(max)} w jednym tygodniu, użycie w ${active} z ${n} tygodni. Strzałki pokazują poszczególne tygodnie.`}
            onPointerDown={pick} onPointerMove={pick}
            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setSel(null); }} onKeyDown={onKey}>
            <svg width="100%" height="100%" aria-hidden="true" focusable="false">
              <line className="uchart-base" x1="0" x2="100%" y1="100%" y2="100%" />
              <line className="uchart-grid" x1="0" x2="100%" y1="8%" y2="8%" />
              {weeks.map((w, i) => {
                const bh = h(w.grams);
                if (!bh) return null;
                const x = `${i * slot + slot * 0.18}%`;
                const wd = `${slot * 0.64}%`;
                const cls = `uchart-bar${sel == null || sel === i ? '' : ' dim'}`;
                return (
                  <g key={w.week} className={cls}>
                    <rect x={x} width={wd} y={`${100 - bh}%`} height={`${bh}%`} rx="3" />
                    {/* dolna część bez zaokrąglenia: słupek stoi płasko na osi */}
                    <rect x={x} width={wd} y={`${100 - Math.min(bh, 3)}%`} height={`${Math.min(bh, 3)}%`} />
                  </g>
                );
              })}
            </svg>
            <span className="uchart-max" aria-hidden="true">{g(max)}</span>
          </div>
          <div className="uchart-x" aria-hidden="true">
            {weeks.map((w, i) => <span key={w.week}>{i % 3 === 0 ? ddmm(w.week) : i === n - 1 ? 'teraz' : ''}</span>)}
          </div>
          <div className="sr-only"><table>
            <caption>Zużycie tygodniowe, ostatnie {n} tygodni</caption>
            <thead><tr><th scope="col">Tydzień od</th><th scope="col">Zużycie</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.week}><td>{ddmm(w.week)}</td><td>{g(w.grams)}</td></tr>)}</tbody>
          </table></div>
        </>
      )}
    </div>
  );
}
