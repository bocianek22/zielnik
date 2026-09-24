'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { EFFECTS, EFFECT_HELP, TAG_THRESHOLD, strainTags } from '@/lib/effects';

const N = EFFECTS.length, SIZE = 280, C = SIZE / 2, R = 92;
const pt = (i, v) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
  return [C + Math.cos(a) * R * (v / 10), C + Math.sin(a) * R * (v / 10)];
};
const poly = (vals) => vals.map((v, i) => pt(i, v ?? 0).join(',')).join(' ');

function Radar({ avg, mine }) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="radar" role="img" aria-label="Wykres odczuć: średnia i Twoje oceny">
      {[2.5, 5, 7.5, 10].map((lvl) => (
        <polygon key={lvl} points={poly(EFFECTS.map(() => lvl))} fill="none" stroke="#d7e0c8" />
      ))}
      {EFFECTS.map(([k, label], i) => {
        const [x, y] = pt(i, 10), [lx, ly] = pt(i, 12.6);
        return (
          <g key={k}>
            <line x1={C} y1={C} x2={x} y2={y} stroke="#d7e0c8" />
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#4c5d50">{label}</text>
          </g>
        );
      })}
      <polygon points={poly(avg)} fill="rgba(217,153,43,.30)" stroke="#d9992b" strokeWidth="2" />
      <polygon points={poly(mine)} fill="rgba(47,91,58,.18)" stroke="#2f5b3a" strokeWidth="2" strokeDasharray="5 3" />
    </svg>
  );
}

export default function Effects({ strain, meId }) {
  const router = useRouter();
  const saved = strain.entries.find((e) => e.userId === meId)?.effects || {};
  const [mine, setMine] = useState(() => Object.fromEntries(EFFECTS.map(([k]) => [k, saved[k] ?? null])));
  const [msg, setMsg] = useState('');

  const avg = EFFECTS.map(([k]) => {
    const v = strain.entries.map((e) => e.effects?.[k]).filter((x) => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  });

  async function save() {
    setMsg('Zapisuję…');
    try { await api(`/api/strains/${strain.id}/effects`, 'PUT', { effects: mine }); setMsg('Zapisano'); router.refresh(); }
    catch (e) { setMsg(e.message); }
  }

  return (
    <section className="card effects">
      <h2>Skala odczuć</h2>
      <p className="muted">Oceń, jak ta odmiana działała na Ciebie (0–10). To Twoje subiektywne odczucia, nie zalecenia medyczne. Suwak, którego nie ruszysz, pozostaje bez oceny.</p>
      <p>Tagi efektów: {strainTags(strain).length ? strainTags(strain).map((t) => <span key={t} className="chip tag">{t}</span>) : <span className="muted">brak (tag pojawia się, gdy średnia widocznych ocen efektu wynosi co najmniej {String(TAG_THRESHOLD).replace('.', ',')}).</span>}</p>
      <div className="effects-body">
        <div>
          <Radar avg={avg} mine={EFFECTS.map(([k]) => mine[k])} />
          <p className="legend"><span className="dot avg" /> średnia wszystkich <span className="dot me" /> Ty</p>
        </div>
        <div className="sliders">
          {EFFECTS.map(([k, label]) => (
            <div key={k} className="slider">
              <label htmlFor={`fx-${k}`}>{label} <b>{mine[k] ?? '–'}</b></label>
              <small className="muted">{EFFECT_HELP[k]}</small>
              <input id={`fx-${k}`} type="range" min="0" max="10" step="1" value={mine[k] ?? 5}
                onChange={(e) => setMine((p) => ({ ...p, [k]: Number(e.target.value) }))} />
              {mine[k] != null && <button type="button" className="btn ghost small" onClick={() => setMine((p) => ({ ...p, [k]: null }))}>Wyczyść ocenę</button>}
            </div>
          ))}
          <div className="row">
            <button className="btn small" onClick={save}>Zapisz odczucia</button>
            <span className="muted" role="status">{msg}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
