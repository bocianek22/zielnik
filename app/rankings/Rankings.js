'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { KINDS } from '@/lib/kinds';
import { FORMS } from '@/lib/forms';
import { TAG_LIST } from '@/lib/effects';
import Icon from '../components/Icon';
import { parseNum, decimalProps } from '../components/num';

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
  ['week', 'Tydzień', 'Oceny od poniedziałku.'],
  ['month', 'Miesiąc', 'Oceny od 1. dnia miesiąca.'],
  ['all', 'Ogółem', 'Wszystkie oceny.'],
];

const dec = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

function Seg({ items, value, set, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([k, l]) => <button key={k || 'all'} type="button" aria-pressed={value === k} className={value === k ? 'on' : ''} onClick={() => set(k)}>{l}</button>)}
    </div>
  );
}

export default function Rankings({ strains, meId }) {
  const [scope, setScope] = useState('all');
  const [metric, setMetric] = useState('sum');
  const [period, setPeriod] = useState('all');
  const [open, setOpen] = useState(false);
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
    if (minThc !== '' && !(s.thc != null && s.thc >= (parseNum(minThc) || 0))) return false;
    const mx = parseNum(maxThc);
    if (mx != null && !Number.isNaN(mx) && !(s.thc != null && s.thc <= mx)) return false;
    return true;
  }), [strains, kind, form, tag, producer, minThc, maxThc]);

  const active = [kind, form, tag, producer, minThc, maxThc].filter((v) => v !== '').length;
  const clear = () => { setKind(''); setForm(''); setTag(''); setProducer(''); setMinThc(''); setMaxThc(''); };
  const [, title, hint] = PERIODS.find(([k]) => k === period);
  const rows = useMemo(() => rank(filtered, scope, meId, period, metric), [filtered, scope, meId, period, metric]);

  return (
    <div className="rk">
      <div className="rk-tools">
        <Seg items={[['all', 'Wspólne'], ['mine', 'Moje']]} value={scope} set={setScope} label="Zakres rankingu" />
        <Seg items={[['sum', 'Suma ocen'], ['avg', 'Średnia ocen']]} value={metric} set={setMetric} label="Sposób liczenia" />
        <button type="button" className={`btn ghost filter-btn${active ? ' active' : ''}`} onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="rk-filters"
          aria-label={`Filtry${active ? ` (aktywne: ${active})` : ''}`}>
          <Icon name="filter" size={20} />{active ? <span className="count">{active}</span> : null}
        </button>
      </div>

      {open && (
        <div id="rk-filters" className="rk-filters">
          <div className="rk-grid">
            <div className="field"><label htmlFor="rk-kind">Rodzaj</label>
              <select id="rk-kind" className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Wszystkie</option>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
            <div className="field"><label htmlFor="rk-form">Postać</label>
              <select id="rk-form" className="input" value={form} onChange={(e) => setForm(e.target.value)}>
                <option value="">Każda</option>{FORMS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></div>
            <div className="field"><label htmlFor="rk-tag">Efekt (tag)</label>
              <select id="rk-tag" className="input" value={tag} onChange={(e) => setTag(e.target.value)}>
                <option value="">Dowolny</option>{TAG_LIST.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
            <div className="field"><label htmlFor="rk-prod">Producent</label>
              <select id="rk-prod" className="input" value={producer} onChange={(e) => setProducer(e.target.value)}>
                <option value="">Wszyscy</option>{producers.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div className="field"><label htmlFor="rk-min">THC od (%)</label>
              <input id="rk-min" className="input" {...decimalProps} value={minThc} onChange={(e) => setMinThc(e.target.value)} /></div>
            <div className="field"><label htmlFor="rk-max">THC do (%)</label>
              <input id="rk-max" className="input" {...decimalProps} value={maxThc} onChange={(e) => setMaxThc(e.target.value)} /></div>
          </div>
          {active > 0 && <button type="button" className="btn text" onClick={clear}>Wyczyść filtry</button>}
        </div>
      )}

      <Seg items={PERIODS.map(([k, l]) => [k, l])} value={period} set={setPeriod} label="Okres" />
      <p className="rk-hint" aria-live="polite">{hint} {rows.length > 0 && <span className="num">Pozycji: {rows.length}.</span>}</p>

      {rows.length === 0 ? (
        <div className="card empty">
          <Icon name="chart" size={32} />
          <h2>Brak ocen</h2>
          <p>{active ? 'W okresie „' + title.toLowerCase() + '” nic nie pasuje do filtrów.' : 'W okresie „' + title.toLowerCase() + '” nie ma jeszcze ocen.'}</p>
          {active > 0 && <button type="button" className="btn ghost" onClick={clear}>Wyczyść filtry</button>}
        </div>
      ) : (
        <ol className="list rk-list">
          {rows.map((r) => (
            <li key={r.s.id}>
              <Link href={`/strains/${r.s.id}`} className={`list-row rk-row${r.pos <= 3 ? ' top' : ''}`}>
                <span className="rk-pos" aria-label={`Miejsce ${r.pos}`}>{r.pos}</span>
                <span className="lr-main">
                  <b className="rk-name dn">{r.s.name}</b>
                  <span className="lr-sub"><span className="dn">{r.s.producer}</span>
                    {(r.s.kind || r.s.type) && <> · {r.s.kind ? <span className={`kind kind-${r.s.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(r.s.kind)}</span> : cap(r.s.type)}</>}
                    {r.s.thc != null && <span className="num"> · THC {dec(r.s.thc)}%</span>}</span>
                </span>
                <span className="rk-pts"><b>{metric === 'avg' ? dec(r.avg) : dec(r.sum)}</b><small>{metric === 'avg' ? 'średnia' : 'punktów'}, {r.n} {r.n === 1 ? 'ocena' : r.n % 10 >= 2 && r.n % 10 <= 4 && (r.n % 100 < 12 || r.n % 100 > 14) ? 'oceny' : 'ocen'}</small></span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
