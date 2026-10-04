'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { SYMPTOMS } from '@/lib/symptoms';
import Icon from '../components/Icon';

// [klucz, etykieta, opis skali, kolor] dla formularza; kreska i kształt punktu wykresu w lib/symptoms.js
const FIELDS = SYMPTOMS.map((s) => [s.key, s.label, s.help, s.color]);
// Dzień w czasie polskim, a nie UTC (po północy toISOString dawało wczoraj). Do zamiany na todayPL z lib/date.js.
const dayPL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' });
const todayIso = () => dayPL.format(new Date());
const shiftDay = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const yesterdayIso = () => shiftDay(todayIso(), -1);
const nf = (n) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: 1 });
const ddmm = (day) => day.slice(5).split('-').reverse().join('.');
const longDay = (day) => new Date(`${day}T12:00:00Z`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' });

// Kształt punktu: przy pojedynczym dniu bez linii tylko on odróżnia objawy (obok koloru)
function Marker({ shape, x, y, color, r = 3.5 }) {
  const common = { fill: color, stroke: 'var(--surface)', strokeWidth: 1 };
  if (shape === 'square') return <rect x={x - r * 0.85} y={y - r * 0.85} width={r * 1.7} height={r * 1.7} {...common} />;
  if (shape === 'triangle') return <path d={`M${x},${y - r * 1.1}L${x + r},${y + r * 0.75}L${x - r},${y + r * 0.75}Z`} {...common} />;
  if (shape === 'diamond') return <path d={`M${x},${y - r * 1.2}L${x + r * 1.05},${y}L${x},${y + r * 1.2}L${x - r * 1.05},${y}Z`} {...common} />;
  return <circle cx={x} cy={y} r={r} {...common} />;
}

// Próbka do legendy: ta sama kreska i ten sam punkt co na wykresie
function Swatch({ s }) {
  return (
    <svg className="sym-swatch" viewBox="0 0 28 12" width="28" height="12" aria-hidden="true">
      <line x1="1" x2="27" y1="6" y2="6" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash || undefined} />
      <Marker shape={s.marker} x={14} y={6} color={s.color} />
    </svg>
  );
}

function Chart({ rows, usage }) {
  const days = 30, W = 360, H = 200, L = 24, B = 24, T = 8, R = 8;
  const end = todayIso(), byDay = Object.fromEntries(rows.map((r) => [r.day, r])), use = Object.fromEntries(usage.map((u) => [u.day, u.grams]));
  const useMl = Object.fromEntries(usage.map((u) => [u.day, u.ml || 0])); // olej i pen: tylko w tabeli, słupki pokazują gramy suszu
  const xs = Array.from({ length: days }, (_, i) => shiftDay(end, -(days - 1 - i)));
  const x = (i) => L + (i * (W - L - R)) / (days - 1);
  const y = (v) => T + (H - T - B) * (1 - v / 10);
  const maxU = Math.max(1, ...Object.values(use));
  const summary = SYMPTOMS.map(({ key: k, label }) => {
    const vals = xs.map((d) => byDay[d]?.[k]).filter((v) => v != null);
    return vals.length ? `${label}: średnio ${nf(vals.reduce((a, v) => a + v, 0) / vals.length)} z ${vals.length} wpisów` : `${label}: brak wpisów`;
  }).join('. ');
  const listed = xs.filter((d) => byDay[d] || use[d] || useMl[d]).reverse();
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="sym-chart" role="img" aria-label={`Wykres objawów z ostatnich 30 dni, skala 0–10. ${summary}. Wartości z każdego dnia są w tabeli pod wykresem.`}>
        {[0, 5, 10].map((v) => <g key={v}><line className="grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} /><text x={L - 6} y={y(v) + 4} textAnchor="end">{v}</text></g>)}
        {xs.map((d, i) => { if (!use[d]) return null; const h = ((use[d] / maxU) * (H - T - B)) * 0.5; return <rect key={d} className="use" x={x(i) - 2} y={y(0) - h} width="4" height={h} />; })}
        {SYMPTOMS.map(({ key: k, color, dash, marker }) => {
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
        <thead><tr><th scope="col">Dzień</th>{SYMPTOMS.map((s) => <th key={s.key} scope="col">{s.label} (0–10)</th>)}<th scope="col">Zużycie</th></tr></thead>
        <tbody>
          {listed.length === 0 && <tr><td colSpan={SYMPTOMS.length + 2}>Brak wpisów w ostatnich 30 dniach.</td></tr>}
          {listed.map((d) => (
            <tr key={d}><th scope="row">{d === end ? 'dziś' : longDay(d)}</th>
              {SYMPTOMS.map((s) => <td key={s.key}>{byDay[d]?.[s.key] ?? 'nie wpisano'}</td>)}
              <td>{[use[d] > 0 && `${nf(use[d])} g`, useMl[d] > 0 && `${nf(useMl[d])} ml`].filter(Boolean).join(', ') || 'brak'}</td></tr>
          ))}
        </tbody>
      </table></div>
    </>
  );
}

export default function SymptomsBoard() {
  const [data, setData] = useState({ rows: [], usage: [] });
  const [day, setDay] = useState(todayIso());
  const [f, setF] = useState({ pain: '', sleep: '', anxiety: '', mood: '', note: '' });
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { api('/api/symptoms').then((d) => { setData(d); setLoaded(true); }).catch((e) => setMsg({ text: e.message, error: true })); }, []);
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
      <form id="sym-form" className="card stack" onSubmit={save}>
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
              <small id={`sy-${k}-help`}>{help}</small>
              <input id={`sy-${k}`} type="range" min="0" max="10" step="1" value={empty ? 5 : f[k]} aria-describedby={`sy-${k}-help`}
                aria-valuetext={empty ? 'nie wpisano, przesuń, aby ustawić' : `${f[k]} z 10`}
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
      {loaded && data.rows.length === 0 && data.usage.length === 0 ? (
        <section className="card empty">
          <Icon name="pulse" size={32} />
          <h2>Wykres pojawi się po pierwszym wpisie</h2>
          <p>Zapisz, jak się dziś czujesz. Po kilku dniach zobaczysz tu przebieg bólu, snu, lęku i nastroju.</p>
          <button type="button" className="btn" onClick={() => { const f = document.getElementById('sym-form'); f?.scrollIntoView({ block: 'start' }); f?.querySelector('input')?.focus({ preventScroll: true }); }}>Wpisz stan</button>
        </section>
      ) : (
      <section className="card">
        <Chart rows={data.rows} usage={data.usage} />
        <ul className="sym-legend" aria-label="Legenda wykresu">
          {SYMPTOMS.map((s) => <li key={s.key}><Swatch s={s} />{s.label}</li>)}
          <li><i className="bar" aria-hidden="true" />Zużycie (słupki)</li>
        </ul>
      </section>
      )}
    </div>
  );
}
