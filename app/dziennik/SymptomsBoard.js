'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

const FIELDS = [
  ['pain', 'Ból', 'Jak silny był ból lub dyskomfort? 0 = brak, 10 = najgorszy możliwy.', '#a63d2f'],
  ['sleep', 'Jakość snu', 'Jak spałeś ostatniej nocy? 0 = bardzo źle, 10 = doskonale.', '#3f6f9a'],
  ['anxiety', 'Lęk', 'Jak silny był lęk lub napięcie? 0 = brak, 10 = bardzo silny.', '#7e6798'],
  ['mood', 'Nastrój', 'Jaki był Twój nastrój? 0 = bardzo zły, 10 = bardzo dobry.', '#2f7d4a'],
];
const todayIso = () => new Date().toISOString().slice(0, 10);

function Chart({ rows, usage }) {
  const days = 30, W = 560, H = 200, L = 28, B = 24, T = 8, R = 8;
  const end = new Date(todayIso()), byDay = Object.fromEntries(rows.map((r) => [r.day, r])), use = Object.fromEntries(usage.map((u) => [u.day, u.grams]));
  const xs = Array.from({ length: days }, (_, i) => { const d = new Date(end); d.setDate(d.getDate() - (days - 1 - i)); return d.toISOString().slice(0, 10); });
  const x = (i) => L + (i * (W - L - R)) / (days - 1);
  const y = (v) => T + (H - T - B) * (1 - v / 10);
  const maxU = Math.max(1, ...Object.values(use));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="sym-chart" role="img" aria-label="Wykres objawów z ostatnich 30 dni">
      {[0, 5, 10].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#d5dcc0" /><text x={4} y={y(v) + 4} fontSize="10" fill="#5d6c5f">{v}</text></g>)}
      {xs.map((d, i) => use[d] ? <rect key={d} x={x(i) - 3} y={y(0) - ((use[d] / maxU) * (H - T - B)) * 0.5} width="6" height={((use[d] / maxU) * (H - T - B)) * 0.5} fill="#c9c9b8" /> : null)}
      {FIELDS.map(([k, , , color]) => {
        const pts = xs.map((d, i) => (byDay[d]?.[k] != null ? [x(i), y(byDay[d][k])] : null));
        const segs = []; let cur = [];
        pts.forEach((p) => { if (p) cur.push(p.join(',')); else if (cur.length) { segs.push(cur); cur = []; } });
        if (cur.length) segs.push(cur);
        return <g key={k}>{segs.map((s, i) => <polyline key={i} points={s.join(' ')} fill="none" stroke={color} strokeWidth="2" />)}
          {pts.map((p, i) => p && <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={color} />)}</g>;
      })}
      {[0, 10, 20, 29].map((i) => <text key={i} x={x(i)} y={H - 6} fontSize="10" textAnchor="middle" fill="#5d6c5f">{xs[i].slice(5).replace('-', '.')}</text>)}
    </svg>
  );
}

export default function SymptomsBoard() {
  const [data, setData] = useState({ rows: [], usage: [] });
  const [day, setDay] = useState(todayIso());
  const [f, setF] = useState({ pain: '', sleep: '', anxiety: '', mood: '', note: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => { api('/api/symptoms').then(setData).catch((e) => setMsg(e.message)); }, []);
  const existing = useMemo(() => data.rows.find((r) => r.day === day), [data, day]);
  useEffect(() => {
    setF({ pain: existing?.pain ?? '', sleep: existing?.sleep ?? '', anxiety: existing?.anxiety ?? '', mood: existing?.mood ?? '', note: existing?.note ?? '' });
  }, [existing, day]);

  async function save(e) {
    e.preventDefault();
    try { setData(await api('/api/symptoms', 'PUT', { day, ...f })); setMsg('Zapisano.'); } catch (err) { setMsg(err.message); }
  }
  async function remove() {
    if (!confirm('Usunąć wpis z tego dnia?')) return;
    try { setData(await api('/api/symptoms', 'DELETE', { day })); setMsg('Usunięto.'); } catch (err) { setMsg(err.message); }
  }

  return (
    <div className="stack">
      <div className="alert note">Dziennik służy Twojej obserwacji i rozmowie z lekarzem. Dane są prywatne, a średnie z wybranego okresu trafiają do raportu dla lekarza.</div>
      <form className="card stack" onSubmit={save}>
        <div className="row"><div className="field"><label htmlFor="sd">Dzień</label>
          <input id="sd" className="input" type="date" max={todayIso()} value={day} onChange={(e) => setDay(e.target.value)} /></div>
          {existing && <span className="badge">Wpis istnieje, zapis go nadpisze</span>}</div>
        {FIELDS.map(([k, label, help]) => (
          <div key={k} className="slider">
            <label htmlFor={`sy-${k}`}>{label} <b>{f[k] === '' ? '–' : f[k]}</b></label>
            <small className="muted">{help}</small>
            <input id={`sy-${k}`} type="range" min="0" max="10" step="1" value={f[k] === '' ? 5 : f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} />
            {f[k] !== '' && <button type="button" className="btn ghost small" onClick={() => setF({ ...f, [k]: '' })}>Wyczyść</button>}
          </div>
        ))}
        <div className="field"><label htmlFor="sy-note">Notatka (opcjonalnie)</label>
          <input id="sy-note" className="input" maxLength={500} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="row"><button className="btn">Zapisz wpis</button>{existing && <button type="button" className="btn ghost" onClick={remove}>Usuń wpis</button>}<span className="muted" role="status">{msg}</span></div>
      </form>
      <section className="card">
        <h2>Ostatnie 30 dni</h2>
        <Chart rows={data.rows} usage={data.usage} />
        <p className="legend">{FIELDS.map(([k, l, , c]) => <span key={k}><span className="dot" style={{ background: c }} />{l} </span>)}<span><span className="dot" style={{ background: '#c9c9b8' }} />zużycie (słupki)</span></p>
      </section>
    </div>
  );
}
