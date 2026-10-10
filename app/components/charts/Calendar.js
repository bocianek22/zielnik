'use client';
import { useMemo, useRef, useState } from 'react';
import SecHead from '../SecHead';
import Frame from './Frame';
import { addDays, longDay, num, plural, weekday } from './fmt';
import { dayState, levelOf, monthLabels, quarters, thresholds } from './calendar-grid';

// Kalendarz zużycia w Historii (A5): kwartał (13 tygodni × 7 dni) albo rok (4 kwartały; na komputerze w jednym rzędzie).
// Cztery stany dnia różnią się kształtem, nie tylko kolorem: brak wpisu = pusta komórka z ramką, „dzień bez zużycia” (POM-38) =
// pozioma kreska, zużycie = wypełnienie w skali sekwencyjnej --seq-1…4 (kwartyle własnych danych), dziś = obwódka.
// Gramy (susz) i ml (olej, pen) się nie sumują: przełącznik jednostki. Wybór dnia dotykiem (stuknięcie albo ruch w poziomie),
// myszą i klawiaturą (strzałki: ←/→ tydzień, ↑/↓ dzień, Home/End, Escape); odczyt w nagłówku (aria-live), dni też w tabeli .sr-only.
const UNIT_NAME = { g: 'Susz', ml: 'Olej i pen' };
const WD = ['pn', '', 'śr', '', 'pt', '', 'nd'];
const STATE_TEXT = { none: 'brak wpisu', nouse: 'dzień bez zużycia', other: null };

export default function Calendar({ data, empty }) {
  const { today, rows } = data;
  const byDay = useMemo(() => new Map(rows.map((r) => [r.day, r])), [rows]);
  const hasMl = rows.some((r) => r.ml > 0), hasG = rows.some((r) => r.g > 0);
  const [mode, setMode] = useState('q');
  const [pick, setPick] = useState(null);
  const [sel, setSel] = useState(null);
  const touch = useRef(null);
  const unit = pick ?? (hasMl && !hasG ? 'ml' : 'g');
  const th = useMemo(() => thresholds(rows.map((r) => (unit === 'ml' ? r.ml : r.g))), [rows, unit]);
  const blocks = useMemo(() => quarters(today, mode === 'y' ? 4 : 1), [today, mode]);
  const days = useMemo(() => blocks.flatMap((b) => b.weeks.flat().filter(Boolean)), [blocks]);
  if (!hasG && !hasMl && !rows.some((r) => r.noUse)) return (<><h2 className="section-label">Kalendarz zużycia</h2>{empty}</>);

  const first = days[0];
  const cur = sel && sel >= first && sel <= today ? sel : null; // wybrany dzień spoza widoku (po zmianie kwartału/roku) znika
  const state = (d) => dayState(byDay.get(d), unit);
  const valueOf = (d) => (unit === 'ml' ? byDay.get(d)?.ml : byDay.get(d)?.g) || 0;
  const name = unit === 'ml' ? 'olej i pen' : 'susz';
  const usedDays = days.filter((d) => state(d) === 'use').length;
  const noUseDays = days.filter((d) => state(d) === 'nouse').length;
  const spoken = (d) => {
    const s = state(d);
    if (s === 'use') return `${num(valueOf(d))} ${unit}${byDay.get(d).n > 1 ? `, ${byDay.get(d).n} wpisy` : ''}`;
    if (s === 'other') return `tylko ${unit === 'ml' ? 'susz' : 'olej lub pen'}`;
    return STATE_TEXT[s];
  };

  const at = (e) => {
    const el = e.pointerType === 'mouse' ? e.target : document.elementFromPoint(e.clientX, e.clientY);
    return el?.closest?.('[data-d]')?.dataset.d ?? null;
  };
  const down = (e) => {
    if (e.pointerType === 'mouse') { const d = at(e); if (d) setSel(d); return; }
    touch.current = { x: e.clientX, y: e.clientY, h: false, moved: false };
  };
  const move = (e) => {
    const t = touch.current;
    if (e.pointerType === 'mouse') { const d = at(e); if (d) setSel(d); return; }
    if (!t) return;
    const dx = Math.abs(e.clientX - t.x), dy = Math.abs(e.clientY - t.y);
    if (!t.h && dx > 8 && dx > dy) t.h = true;
    if (dx > 8 || dy > 8) t.moved = true;
    if (t.h) { const d = at(e); if (d) setSel(d); }
  };
  const up = (e) => {
    const t = touch.current;
    touch.current = null;
    if (e.pointerType === 'mouse' || !t || t.moved) return;
    const d = at(e);
    if (d) setSel(d === cur ? null : d);
  };
  const onKey = (e) => {
    const from = cur ?? today;
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key];
    if (step != null) {
      e.preventDefault();
      const next = cur == null ? today : addDays(from, step);
      setSel(next < first ? first : next > today ? today : next);
    } else if (e.key === 'Home') { e.preventDefault(); setSel(first); }
    else if (e.key === 'End') { e.preventDefault(); setSel(today); }
    else if (e.key === 'Escape') setSel(null);
  };

  const read = cur == null
    ? <><span>{mode === 'y' ? 'w ostatnim roku' : 'w ostatnim kwartale'}</span> <b>{usedDays} {plural(usedDays, 'dzień', 'dni')} ze zużyciem</b></>
    : <><span>{weekday(cur)} {longDay(cur)}</span> <b>{spoken(cur)}</b></>;

  return (
    <>
      <SecHead cat="stock" icon="calendar">Kalendarz zużycia</SecHead>
      <Frame className="card cal" headClass="cal-head" readClass="cal-read" read={read}
        axis={(
          <ul className="cal-legend" aria-label="Legenda kalendarza">
            <li><i className="cal-c none" aria-hidden="true" />brak wpisu</li>
            <li><i className="cal-c nouse" aria-hidden="true" />dzień bez zużycia</li>
            {hasMl && hasG && <li><i className="cal-c other" aria-hidden="true" />tylko {unit === 'ml' ? 'susz' : 'olej lub pen'}</li>}
            <li className="cal-scale">mniej{[1, 2, 3, 4].map((l) => <i key={l} className={`cal-c use l${l}`} aria-hidden="true" />)}więcej</li>
            <li><i className="cal-c none is-today" aria-hidden="true" />dziś</li>
          </ul>
        )}
        table={(
          <table>
            <caption>Kalendarz zużycia ({name}): dni ze zużyciem lub oznaczone jako bez zużycia</caption>
            <thead><tr><th scope="col">Dzień</th><th scope="col">Stan</th></tr></thead>
            <tbody>{days.filter((d) => state(d) !== 'none').map((d) => <tr key={d}><td>{weekday(d)} {longDay(d)} {d.slice(0, 4)}</td><td>{spoken(d)}</td></tr>)}</tbody>
          </table>
        )}>
        <div className="cal-ctl">
          <div className="seg" role="group" aria-label="Zakres kalendarza">
            {[['q', 'Kwartał'], ['y', 'Rok']].map(([k, t]) => (
              <button key={k} type="button" aria-pressed={mode === k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{t}</button>
            ))}
          </div>
          {hasMl && hasG && (
            <div className="seg" role="group" aria-label="Jednostka kalendarza">
              {['g', 'ml'].map((u) => (
                <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => setPick(u)}>{UNIT_NAME[u]} ({u})</button>
              ))}
            </div>
          )}
        </div>
        <div className="cal-scrub" data-mode={mode} tabIndex={0} role="group"
          aria-label={`Kalendarz zużycia (${name}), ${mode === 'y' ? 'ostatni rok' : 'ostatnie 13 tygodni'}: ${usedDays} ${plural(usedDays, 'dzień', 'dni')} ze zużyciem, ${noUseDays} ${plural(noUseDays, 'dzień', 'dni')} bez zużycia. Strzałkami wybierzesz dzień.`}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { touch.current = null; }}
          onPointerLeave={(e) => { if (e.pointerType === 'mouse') setSel(null); }} onKeyDown={onKey}>
          {blocks.map((b) => (
            <div className="cal-q" key={b.first} aria-hidden="true">
              <div className="cal-months">
                {monthLabels(b.weeks).map((m) => <span key={m.col} style={{ gridColumn: m.col + 2 }}>{m.text}</span>)}
              </div>
              <div className="cal-grid">
                {WD.map((t, k) => <span key={k} className="cal-wd">{t}</span>)}
                {b.weeks.flatMap((w) => w.map((d, k) => {
                  if (!d) return <i key={`f${b.first}${k}`} className="cal-c fut" />;
                  const s = state(d);
                  const cls = `cal-c ${s}${s === 'use' ? ` l${levelOf(valueOf(d), th)}` : ''}${d === today ? ' is-today' : ''}${d === cur ? ' on' : ''}`;
                  return <i key={d} className={cls} data-d={d} />;
                }))}
              </div>
            </div>
          ))}
        </div>
      </Frame>
    </>
  );
}
