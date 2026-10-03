'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const FIELDS = [
  ['pain', 'Ból', 'Jak silny był ból lub dyskomfort? 0 = brak, 10 = najgorszy możliwy.', 'var(--chart-1)'],
  ['sleep', 'Jakość snu', 'Jak spałeś ostatniej nocy? 0 = bardzo źle, 10 = doskonale.', 'var(--chart-2)'],
  ['anxiety', 'Lęk', 'Jak silny był lęk lub napięcie? 0 = brak, 10 = bardzo silny.', 'var(--chart-3)'],
  ['mood', 'Nastrój', 'Jaki był Twój nastrój? 0 = bardzo zły, 10 = bardzo dobry.', 'var(--chart-4)'],
];
const iso = (d) => d.toISOString().slice(0, 10);
const todayIso = () => iso(new Date());
const yesterdayIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return iso(d); };
const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 1 });

function Chart({ rows, usage }) {
  const days = 30, W = 360, H = 200, L = 24, B = 24, T = 8, R = 8;
  const end = new Date(todayIso()), byDay = Object.fromEntries(rows.map((r) => [r.day, r])), use = Object.fromEntries(usage.map((u) => [u.day, u.grams]));
  const xs = Array.from({ length: days }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (days - 1 - i)); return iso(d); });
  const x = (i) => L + (i * (W - L - R)) / (days - 1);
  const y = (v) => T + (H - T - B) * (1 - v / 10);
  const maxU = Math.max(1, ...Object.values(use));
  const summary = FIELDS.map(([k, label]) => {
    const vals = xs.map((d) => byDay[d]?.[k]).filter((v) => v != null);
    return vals.length ? `${label}: średnio ${nf(vals.reduce((a, v) => a + v, 0) / vals.length)} z ${vals.length} wpisów` : `${label}: brak wpisów`;
  }).join('. ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sym-chart" role="img" aria-label={`Wykres objawów z ostatnich 30 dni, skala 0–10. ${summary}.`}>
      {[0, 5, 10].map((v) => <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
      {xs.map((d, i) => { if (!use[d]) return null; const h = ((use[d] / maxU) * (H - T - B)) * 0.5; return <rect key={d} className="use" x={x(i) - 2} y={y(0) - h} width="4" height={h} />; })}
      {FIELDS.map(([k, , , color]) => {
        const pts = xs.map((d, i) => (byDay[d]?.[k] != null ? [x(i), y(byDay[d][k])] : null));
        const segs = []; let cur = [];
        pts.forEach((p) => { if (p) cur.push(p.join(',')); else if (cur.length) { segs.push(cur); cur = []; } });
        if (cur.length) segs.push(cur);
        return <g key={k}>{segs.map((s, i) => <polyline key={i} points={s.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />)}
          {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color} />)}</g>;
      })}
      {[0, 10, 20, 29].map((i) => <text key={i} x={x(i)} y={H - 6} textAnchor="middle">{xs[i].slice(5).split('-').reverse().join('.')}</text>)}
    </svg>
  );
}

export default function SymptomsBoard() {
  const [data, setData] = useState({ rows: [], usage: [] });
  const [day, setDay] = useState(todayIso());
  const [f, setF] = useState({ pain: '', sleep: '', anxiety: '', mood: '', note: '' });
  const [msg, setMsg] = useState(null);

  useEffect(() => { api('/api/symptoms').then(setData).catch((e) => setMsg({ text: e.message, error: true })); }, []);
  const existing = useMemo(() => data.rows.find((r) => r.day === day), [data, day]);
  useEffect(() => {
    setF({ pain: existing?.pain ?? '', sleep: existing?.sleep ?? '', anxiety: existing?.anxiety ?? '', mood: existing?.mood ?? '', note: existing?.note ?? '' });
  }, [existing, day]);

  async function save(e) {
    e.preventDefault();
    try { setData(await api('/api/symptoms', 'PUT', { day, ...f })); setMsg({ text: 'Zapisano.' }); } catch (err) { setMsg({ text: err.message, error: true }); }
  }
  async function remove() {
    if (!confirm('Usunąć wpis z tego dnia?')) return;
    try { setData(await api('/api/symptoms', 'DELETE', { day })); setMsg({ text: 'Usunięto.' }); } catch (err) { setMsg({ text: err.message, error: true }); }
  }

  return (
    <div className="stack">
      <div className="alert note">Dziennik służy Twojej obserwacji i rozmowie z lekarzem. Dane są prywatne, a średnie z wybranego okresu trafiają do raportu dla lekarza.</div>
      <form className="card stack" onSubmit={save}>
        <div className="sym-day">
          <div className="field"><label htmlFor="sd">Dzień</label>
            <input id="sd" className="input" type="date" max={todayIso()} value={day} onChange={(e) => setDay(e.target.value)} /></div>
          <div className="seg" role="group" aria-label="Szybki wybór dnia">
            <button type="button" className={day === yesterdayIso() ? 'on' : ''} aria-pressed={day === yesterdayIso()} onClick={() => setDay(yesterdayIso())}>Wczoraj</button>
            <button type="button" className={day === todayIso() ? 'on' : ''} aria-pressed={day === todayIso()} onClick={() => setDay(todayIso())}>Dziś</button>
          </div>
        </div>
        {existing && <p className="muted small sym-exists">Wpis z tego dnia już istnieje, zapis go nadpisze.</p>}
        {FIELDS.map(([k, label, help]) => {
          const empty = f[k] === '';
          return (
            <div key={k} className={`sym-slider${empty ? ' unset' : ''}`}>
              <div className="sym-head">
                <label htmlFor={`sy-${k}`}>{label}</label>
                <span className={`sym-val${empty ? ' unset' : ''}`} aria-hidden="true">{empty ? 'Nie wpisano' : f[k]}</span>
                {!empty && <button type="button" className="btn text small" onClick={() => setF({ ...f, [k]: '' })} aria-label={`Wyczyść: ${label}`}>Wyczyść</button>}
              </div>
              <small>{help}</small>
              <input id={`sy-${k}`} type="range" min="0" max="10" step="1" value={empty ? 5 : f[k]} aria-valuetext={empty ? 'nie wpisano' : `${f[k]} z 10`}
                onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
              <div className="sym-scale" aria-hidden="true"><span>0</span><span>10</span></div>
            </div>
          );
        })}
        <div className="field"><label htmlFor="sy-note">Notatka (opcjonalnie)</label>
          <input id="sy-note" className="input" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        {msg && <div className={`alert ${msg.error ? 'error' : 'ok'}`} role={msg.error ? 'alert' : 'status'}>{msg.text}</div>}
        <div className="sym-actions"><button className="btn">Zapisz wpis</button>{existing && <button type="button" className="btn danger" onClick={remove}>Usuń wpis</button>}</div>
      </form>
      <h2 className="section-label">Ostatnie 30 dni</h2>
      <section className="card">
        <Chart rows={data.rows} usage={data.usage} />
        <ul className="sym-legend">
          {FIELDS.map(([k, l, , c]) => <li key={k}><i style={{ background: c }} />{l}</li>)}
          <li><i className="bar" />Zużycie (słupki)</li>
        </ul>
      </section>
    </div>
  );
}
