'use client';
import { useMemo, useState } from 'react';
import SecHead from '../SecHead';
import Frame from './Frame';
import DayCard from '../DayCard';
import { addDays, longDay, plural, weekday } from './fmt';
import { monthLabels, quarters } from './calendar-grid';
import { LEVELS, symptomLevel } from './symptom-levels';
import { SYMPTOMS } from '@/lib/symptoms';

// „Rok objawów” (POM-50): siatka dni (kwartał albo rok) dla jednego wybranego objawu, kolor = wartość 0–10 w jednej barwie,
// dzień bez wpisu pusty z ramką. Wybór dnia stuknięciem, myszą albo strzałkami; „Szczegóły dnia” i Enter otwierają kartę dnia.
// Odczyt w nagłówku (aria-live), wszystkie dni z wartością w tabeli .sr-only. Bez ocen i porównań.
const WD = ['pn', '', 'śr', '', 'pt', '', 'nd'];

export default function SymptomYear({ data }) {
  const { today, rows, custom } = data;
  const byDay = useMemo(() => new Map(rows.map((r) => [r.day, r])), [rows]);
  const measures = useMemo(() => [...SYMPTOMS.map((s) => ({ key: s.key, label: s.label })), ...custom.map((c) => ({ key: `c${c.id}`, label: c.name, custom: true }))], [custom]);
  const [key, setKey] = useState('pain');
  const [mode, setMode] = useState('q');
  const [sel, setSel] = useState(null);
  const [card, setCard] = useState(null);
  const blocks = useMemo(() => quarters(today, mode === 'y' ? 4 : 1), [today, mode]);
  const days = useMemo(() => blocks.flatMap((b) => b.weeks.flat().filter(Boolean)), [blocks]);
  if (!rows.length) return null;

  const m = measures.find((x) => x.key === key) ?? measures[0];
  const val = (d) => byDay.get(d)?.[m.key] ?? null;
  const first = days[0];
  const cur = sel && sel >= first && sel <= today ? sel : null;
  const withVal = days.filter((d) => val(d) != null).length;
  const at = (e) => (e.pointerType === 'mouse' ? e.target : document.elementFromPoint(e.clientX, e.clientY))?.closest?.('[data-d]')?.dataset.d ?? null;
  const onKey = (e) => {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (step != null) {
      e.preventDefault();
      const next = cur == null ? today : addDays(cur, step);
      setSel(next < first ? first : next > today ? today : next);
    } else if (e.key === 'Home') { e.preventDefault(); setSel(first); }
    else if (e.key === 'End') { e.preventDefault(); setSel(today); }
    else if (e.key === 'Escape') setSel(null);
    else if (e.key === 'Enter' && cur) { e.preventDefault(); setCard(cur); }
  };
  const label = <span className={m.custom ? 'dn' : undefined}>{m.label}</span>;
  const read = cur == null
    ? <><span>{mode === 'y' ? 'w ostatnim roku' : 'w ostatnim kwartale'}</span> <b>{withVal} {plural(withVal, 'dzień', 'dni')} z wpisem</b></>
    : <><span>{weekday(cur)} {longDay(cur)}</span> <b>{val(cur) != null ? `${val(cur)} z 10` : 'brak wpisu'}</b></>;

  return (
    <>
      <SecHead cat="journal" icon="calendar">Rok objawów</SecHead>
      <Frame className="card cal sym-year" headClass="cal-head" readClass="cal-read" read={read}
        axis={(
          <ul className="cal-legend" aria-label="Legenda">
            <li><i className="cal-c none" aria-hidden="true" />brak wpisu</li>
            <li className="cal-scale">0{LEVELS.map((_, i) => <i key={i} className={`cal-c use l${i + 1}`} aria-hidden="true" />)}10</li>
          </ul>
        )}
        table={(
          <table>
            <caption>{m.label}: wartości z dziennika (0–10)</caption>
            <thead><tr><th scope="col">Dzień</th><th scope="col">Wartość</th></tr></thead>
            <tbody>{days.filter((d) => val(d) != null).map((d) => <tr key={d}><td>{weekday(d)} {longDay(d)} {d.slice(0, 4)}</td><td>{val(d)}</td></tr>)}</tbody>
          </table>
        )}>
        <div className="cal-ctl">
          <div className="seg sym-year-pick" role="group" aria-label="Objaw">
            {measures.map((x) => (
              <button key={x.key} type="button" aria-pressed={x.key === m.key} className={x.key === m.key ? 'on' : ''} onClick={() => setKey(x.key)}>
                <span className={x.custom ? 'dn' : undefined}>{x.label}</span>
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Zakres">
            {[['q', 'Kwartał'], ['y', 'Rok']].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="cal-scrub" data-mode={mode} tabIndex={0} role="group"
          aria-label={`Rok objawów, ${m.label}: ${withVal} ${plural(withVal, 'dzień', 'dni')} z wpisem. Strzałkami wybierzesz dzień, Enter otworzy jego szczegóły.`}
          onPointerUp={(e) => { const d = at(e); if (d) setSel(d === cur ? null : d); }} onKeyDown={onKey}>
          {blocks.map((b) => (
            <div className="cal-q" key={b.first} aria-hidden="true">
              <div className="cal-months">{monthLabels(b.weeks).map((x) => <span key={x.col} style={{ gridColumn: x.col + 2 }}>{x.text}</span>)}</div>
              <div className="cal-grid">
                {WD.map((t, k) => <span key={k} className="cal-wd">{t}</span>)}
                {b.weeks.flatMap((w) => w.map((d, k) => {
                  if (!d) return <i key={`f${b.first}${k}`} className="cal-c fut" />;
                  const l = symptomLevel(val(d));
                  return <i key={d} data-d={d} className={`cal-c ${l ? `use l${l}` : 'none'}${d === today ? ' is-today' : ''}${d === cur ? ' on' : ''}`} />;
                }))}
              </div>
            </div>
          ))}
        </div>
        {cur && <button type="button" className="btn soft small cal-open" onClick={() => setCard(cur)}>Szczegóły dnia: {weekday(cur)} {longDay(cur)}</button>}
        {card && <DayCard key={card} day={card} onClose={() => setCard(null)} />}
      </Frame>
      <p className="muted small">{label}: ciemniej = wyższa liczba na skali 0–10. Kolor nie oznacza „lepiej” ani „gorzej”.</p>
    </>
  );
}
