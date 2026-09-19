'use client';
import { useState } from 'react';

function startOf(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // poniedziałek
  else if (period === 'month') d.setDate(1);
  else return 0;
  return d.getTime();
}

// Ranking odmian wg sumy ocen z danego okresu (wspólny: wszyscy, osobisty: tylko moje)
function rank(strains, scope, meId, period) {
  const since = startOf(period);
  const rows = [];
  for (const s of strains) {
    const rs = s.ratings.filter((r) => (scope === 'mine' ? r.userId === meId : true) && new Date(r.at).getTime() >= since);
    if (rs.length) rows.push({ s, sum: rs.reduce((a, r) => a + Number(r.rating), 0), n: rs.length });
  }
  rows.sort((a, b) => b.sum - a.sum || b.n - a.n || a.s.name.localeCompare(b.s.name, 'pl'));
  let pos = 0;
  return rows.map((r, i) => ({ ...r, pos: i > 0 && rows[i - 1].sum === r.sum ? pos : (pos = i + 1) }));
}

const PERIODS = [
  ['week', 'Tydzień', 'od poniedziałku'],
  ['month', 'Miesiąc', 'od 1. dnia miesiąca'],
  ['all', 'Ogółem', 'wszystkie oceny'],
];

export default function Rankings({ strains, meId }) {
  const [scope, setScope] = useState('all');
  return (
    <div className="stack">
      <div className="seg" role="tablist" aria-label="Zakres rankingu">
        {[['all', 'Wspólne'], ['mine', 'Moje']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={scope === k} className={scope === k ? 'on' : ''} onClick={() => setScope(k)}>{label}</button>
        ))}
      </div>
      <div className="rank-grid">
        {PERIODS.map(([key, title, hint]) => {
          const rows = rank(strains, scope, meId, key);
          return (
            <section key={key} className="card rank">
              <h2>{title}</h2>
              <p className="muted rank-hint">{hint}</p>
              {rows.length === 0 ? <p className="muted">Brak ocen w tym okresie.</p> : (
                <ol className="rank-list">
                  {rows.map((r) => (
                    <li key={r.s.id} className={r.pos <= 3 ? `top top-${r.pos}` : ''}>
                      <span className="pos">{r.pos}</span>
                      <span className="who"><b>{r.s.name}</b><small>{r.s.producer}, {r.s.type}</small></span>
                      <span className="pts" title={`${r.n} ${r.n === 1 ? 'ocena' : 'ocen'}`}>{Number(r.sum.toFixed(1))}<small>{scope === 'all' ? `${r.n} ocen` : 'pkt'}</small></span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
