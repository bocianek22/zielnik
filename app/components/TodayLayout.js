'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { TODAY_CARDS, PRESETS, presetOf, moveCard } from '@/lib/today-cards';
import Icon from './Icon';

const LABEL = Object.fromEntries(TODAY_CARDS.map((c) => [c.key, c]));

// POM-48 + UI 5 etap 3: układ ekranu „Dziś” (zapis na koncie, więc działa też po zmianie telefonu). Gotowe układy
// albo własny: kolejność strzałkami (bez przeciągania: działa z klawiatury i czytnikiem) i pokazywanie kart.
// „Plan na dziś” jest zawsze widoczny. Zmiana działa od razu; przy błędzie zapisu układ wraca.
export default function TodayLayout({ layout, onChange }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false); // jeden zapis naraz: odpowiedź starszego nie nadpisze nowszego wyboru
  const { hidden, order } = layout;
  const preset = presetOf(order, hidden);
  async function save(next) {
    const prev = layout;
    onChange(next); setErr(''); setBusy(true);
    try { onChange(await api('/api/today-layout', 'PUT', { hidden: next.hidden, order: next.order })); } catch (e) { onChange(prev); setErr(e.message); } finally { setBusy(false); }
  }
  const toggle = (key, show) => save({ order, hidden: show ? hidden.filter((k) => k !== key) : [...hidden, key] });
  return (
    <fieldset className="today-layout" id="dostosuj">
      <legend className="prefs-title">Układ ekranu „Dziś”</legend>
      <div className="tl-presets" role="radiogroup" aria-label="Gotowy układ">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" role="radio" aria-checked={preset === p.key} disabled={busy}
            className={`tl-preset${preset === p.key ? ' on' : ''}`} onClick={() => save({ order: p.order, hidden: p.hidden })}>
            <b>{p.label}</b><span>{p.sub}</span>
          </button>
        ))}
      </div>
      {!preset && <p className="muted small">Układ własny.</p>}
      <ol className="tl-list" aria-label="Karty w kolejności">
        {order.map((k, i) => {
          const c = LABEL[k];
          return (
            <li key={k} className="tl-row">
              {c.fixed ? <span className="tl-fixed"><Icon name="check" size={18} />{c.label}</span> : (
                <label className="check"><input type="checkbox" disabled={busy} checked={!hidden.includes(k)} onChange={(e) => toggle(k, e.target.checked)} /> {c.label}</label>
              )}
              <span className="tl-move">
                <button type="button" className="icon-btn" disabled={busy || i === 0} aria-label={`Przesuń w górę: ${c.label}`}
                  onClick={() => save({ hidden, order: moveCard(order, k, -1) })}><Icon name="chevronDown" size={18} className="tl-up" /></button>
                <button type="button" className="icon-btn" disabled={busy || i === order.length - 1} aria-label={`Przesuń w dół: ${c.label}`}
                  onClick={() => save({ hidden, order: moveCard(order, k, 1) })}><Icon name="chevronDown" size={18} /></button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="muted small">„Plan na dziś” z pilnymi przypomnieniami (recepta, kończący się zapas) jest zawsze widoczny.</p>
      {err && <p className="alert error" role="alert">{err}</p>}
    </fieldset>
  );
}
