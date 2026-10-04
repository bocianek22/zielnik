'use client';
import { useState } from 'react';
import { SYMPTOMS, customMeta } from '@/lib/symptoms';
import { fmtNum } from '@/lib/units';

const dayWord = (n) => (n === 1 ? 'dzień' : 'dni');
const SHORT = { pain: 'Ból', sleep: 'Sen', anxiety: 'Lęk', mood: 'Nastrój' };

// Jeden wiersz grupy: średnia (od minDays dni) z liczbą dni; poniżej progu tylko liczba dni.
// Bez kolorów lepiej/gorzej i bez strzałek: to opis, nie ocena.
function Row({ title, sub, cell, minDays, dn, label }) {
  const ok = cell.avg != null;
  const desc = ok ? `${label}: średnio ${fmtNum(cell.avg, 1)} z 10` : null;
  return (
    <li className={`list-row obs-row${ok ? '' : ' few'}`}>
      <span className="lr-main">
        <span className={dn ? 'dn' : undefined}>{title}</span>
        <span className="lr-sub">{cell.days} {dayWord(cell.days)}{sub ? ` · ${sub}` : ''}{ok ? '' : ` · za mało danych (min. ${minDays})`}</span>
      </span>
      {ok ? (
        <span className="obs-val">
          <span className="sr-only">{desc}</span>
          <span className="obs-track" aria-hidden="true"><i style={{ left: `${cell.avg * 10}%` }} /></span>
          <b aria-hidden="true">{fmtNum(cell.avg, 1)}</b>
        </span>
      ) : <span className="obs-val none" aria-hidden="true">–</span>}
    </li>
  );
}

export default function ObservationsBoard({ symptoms, minDays, custom = [] }) {
  const all = [...SYMPTOMS, ...custom.map(customMeta)]; // własne objawy (POM-07) jak wbudowane
  // pierwszy objaw z wpisami (kolejność jak w dzienniku)
  const [key, setKey] = useState(() => (all.find((x) => symptoms[x.key].days > 0) || all[0]).key);
  const s = all.find((x) => x.key === key);
  const d = symptoms[key];
  const empty = d.days === 0;
  return (
    <>
      <div className="seg obs-sym" role="group" aria-label="Objaw">
        {all.map((x) => (
          <button key={x.key} type="button" className={x.key === key ? 'on' : ''} aria-pressed={x.key === key} onClick={() => setKey(x.key)}>{SHORT[x.key] ?? x.label}</button>
        ))}
      </div>
      <h2 className="section-label obs-head">
        {s.label}<span>średnia 0–10 · 0 = {s.low}, 10 = {s.high}</span>
      </h2>
      {empty ? (
        <p className="muted small obs-none">Brak wpisów „{s.label.toLowerCase()}” w tym okresie (od pierwszego zapisu zużycia).</p>
      ) : (
        <ul className="list obs-list" aria-label={`${s.label}: średnie według dni`}>
          {d.strains.map((g) => <Row key={g.id} title={g.name} cell={g} minDays={minDays} dn label={s.label}
            sub={key === 'sleep' ? 'dzień wcześniej tylko ta odmiana' : 'tylko ta odmiana'} />)}
          {d.mixed.days > 0 && <Row title="Dni z kilkoma odmianami" cell={d.mixed} minDays={minDays} label={s.label}
            sub={key === 'sleep' ? 'dzień wcześniej' : ''} />}
          {d.none.days > 0 && <Row title="Dni bez zużycia" cell={d.none} minDays={minDays} label={s.label}
            sub={key === 'sleep' ? 'dzień wcześniej' : ''} />}
        </ul>
      )}
      <p className="muted small">
        {key === 'sleep'
          ? 'Sen z danego dnia dotyczy ostatniej nocy, dlatego zestawiamy go z zużyciem z dnia poprzedniego.'
          : 'Wpis z danego dnia zestawiamy z zużyciem z tego samego dnia.'}
        {' '}Kolejność według liczby dni, nie według wyniku.
      </p>
    </>
  );
}
