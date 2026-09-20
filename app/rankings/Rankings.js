'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { KINDS } from '@/lib/kinds';
import { FORMS } from '@/lib/forms';
import { TAG_LIST } from '@/lib/effects';

function startOf(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // poniedziałek
  else if (period === 'month') d.setDate(1);
  else return 0;
  return d.getTime();
}

// Ranking odmian wg sumy albo średniej ocen z okresu (wspólny: wszyscy, osobisty: tylko moje)
function rank(strains, scope, meId, period, metric) {
  const since = startOf(period);
  const rows = [];
  for (const s of strains) {
    const rs = s.ratings.filter((r) => (scope === 'mine' ? r.userId === meId : true) && new Date(r.at).getTime() >= since);
    if (!rs.length) continue;
    const sum = rs.reduce((a, r) => a + Number(r.rating), 0);
    rows.push({ s, sum, n: rs.length, avg: sum / rs.length });
  }
  const val = (r) => (metric === 'avg' ? r.avg : r.sum);
  rows.sort((a, b) => val(b) - val(a) || b.n - a.n || a.s.name.localeCompare(b.s.name, 'pl'));
  let pos = 0;
  return rows.map((r, i) => ({ ...r, pos: i > 0 && val(rows[i - 1]) === val(r) ? pos : (pos = i + 1) }));
}

const PERIODS = [
  ['week', 'Tydzień', 'od poniedziałku'],
  ['month', 'Miesiąc', 'od 1. dnia miesiąca'],
  ['all', 'Ogółem', 'wszystkie oceny'],
];

export default function Rankings({ strains, meId }) {
  const [scope, setScope] = useState('all');
  const [metric, setMetric] = useState('sum');
  const [kind, setKind] = useState('');
  const [form, setForm] = useState('');
  const [tag, setTag] = useState('');
  const [producer, setProducer] = useState('');
  const [minThc, setMinThc] = useState('');
  const [maxThc, setMaxThc] = useState('');

  const producers = useMemo(() => [...new Set(strains.map((s) => s.producer))].sort((a, b) => a.localeCompare(b, 'pl')), [strains]);
  const filtered = useMemo(() => strains.filter((s) => {
    if (kind && s.kind !== kind) return false;
    if (form && s.form !== form) return false;
    if (tag && !s.tags.includes(tag)) return false;
    if (producer && s.producer !== producer) return false;
    if (minThc !== '' && !(s.thc != null && s.thc >= Number(minThc))) return false;
    if (maxThc !== '' && !(s.thc != null && s.thc <= Number(maxThc))) return false;
    return true;
  }), [strains, kind, form, tag, producer, minThc, maxThc]);

  const Seg = ({ items, value, set, label }) => (
    <div className="seg" role="tablist" aria-label={label}>
      {items.map(([k, l]) => <button key={k || 'all'} role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}
    </div>
  );

  return (
    <div className="stack">
      <div className="toolbar">
        <Seg items={[['all', 'Wspólne'], ['mine', 'Moje']]} value={scope} set={setScope} label="Zakres rankingu" />
        <Seg items={[['sum', 'Suma ocen'], ['avg', 'Średnia ocen']]} value={metric} set={setMetric} label="Sposób liczenia" />
      </div>
      <div className="card stack">
        <h2>Filtry</h2>
        <div className="toolbar">
          <Seg items={[['', 'Wszystkie rodzaje'], ...KINDS.map((k) => [k.value, k.label])]} value={kind} set={setKind} label="Rodzaj" />
          <Seg items={[['', 'Każda postać'], ...FORMS]} value={form} set={setForm} label="Postać" />
        </div>
        <div className="row">
          <div className="field"><label htmlFor="rk-tag">Efekt (tag)</label>
            <select id="rk-tag" className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Dowolny</option>{TAG_LIST.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div className="field"><label htmlFor="rk-prod">Producent</label>
            <select id="rk-prod" className="input" value={producer} onChange={(e) => setProducer(e.target.value)}>
              <option value="">Wszyscy</option>{producers.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="field"><label htmlFor="rk-min">THC od (%)</label>
            <input id="rk-min" className="input" type="number" min="0" max="100" step="0.5" value={minThc} onChange={(e) => setMinThc(e.target.value)} /></div>
          <div className="field"><label htmlFor="rk-max">THC do (%)</label>
            <input id="rk-max" className="input" type="number" min="0" max="100" step="0.5" value={maxThc} onChange={(e) => setMaxThc(e.target.value)} /></div>
        </div>
      </div>
      <div className="rank-grid">
        {PERIODS.map(([key, title, hint]) => {
          const rows = rank(filtered, scope, meId, key, metric);
          return (
            <section key={key} className="card rank">
              <h2>{title}</h2>
              <p className="muted rank-hint">{hint}</p>
              {rows.length === 0 ? <p className="muted">Brak ocen w tym okresie dla wybranych filtrów.</p> : (
                <ol className="rank-list">
                  {rows.map((r) => (
                    <li key={r.s.id} className={r.pos <= 3 ? `top top-${r.pos}` : ''}>
                      <span className="pos">{r.pos}</span>
                      <span className="who"><Link href={`/strains/${r.s.id}`}><b>{r.s.name}</b></Link><small>{r.s.producer}, {r.s.kind || r.s.type}{r.s.thc != null ? `, THC ${r.s.thc}%` : ''}</small></span>
                      <span className="pts">{metric === 'avg' ? r.avg.toFixed(1) : Number(r.sum.toFixed(1))}<small>{scope === 'all' ? `${r.n} ocen` : metric === 'avg' ? 'śr.' : 'pkt'}</small></span>
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
