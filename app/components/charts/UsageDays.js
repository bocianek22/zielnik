'use client';
import { useState } from 'react';
import Frame from './Frame';
import Bars from './Bars';
import Empty from './Empty';
import { addDays, ddmm, longDay, num, weekday } from './fmt';

// Zużycie z 14 dni w panelu „Dziś”. Gramy (susz) i ml (olej, pen) nigdy się nie sumują: wykres z przełącznikiem jednostki.
// Daty z dni z serwera (czas polski), nie z zegara przeglądarki, żeby serwer i klient renderowały to samo.
const UNIT_NAME = { g: 'Susz', ml: 'Olej i pen' };
const W = 280, H = 76;

export default function UsageDays({ series: raw }) {
  const sumOf = (k) => raw.reduce((a, d) => a + (Number(d[k]) || 0), 0);
  const hasMl = sumOf('ml') > 0;
  // domyślnie gramy; same wpisy w ml (bez suszu) od razu pokazują ml
  const [pick, setPick] = useState(null);
  const unit = pick ?? (hasMl && !(sumOf('grams') > 0) ? 'ml' : 'g');
  const key = unit === 'ml' ? 'ml' : 'grams';
  const series = raw.map((d) => ({ day: d.day, grams: Number(d[key]) || 0 }));
  const last = series.length - 1;
  const [sel, setSel] = useState(last);
  const i = Math.min(sel, last);
  const max = Math.max(...series.map((d) => d.grams), 0);
  const total = series.reduce((a, d) => a + d.grams, 0);
  const slot = W / series.length;
  const label = (k) => (k === last ? 'Dziś' : k === last - 1 ? 'Wczoraj' : `${weekday(series[k].day)} ${ddmm(series[k].day)}`);
  const spoken = (d, k) => `${k === last ? 'dziś' : longDay(d.day)}: ${num(d.grams)} ${unit}`;

  return (
    <Frame className="usage" headClass="usage-head" title="Zużycie, 14 dni" titleClass="today-h" readClass="usage-sel"
      read={<><span>{label(i)}</span> <b>{num(series[i].grams)} {unit}</b></>}
      axis={(
        <>
          <div className="usage-axis" aria-hidden="true">
            <span>{ddmm(series[0].day)}</span>
            {last >= 7 && <span className="mid" style={{ left: `${((last - 7 + 0.5) / series.length) * 100}%` }}>{ddmm(series[last - 7].day)}</span>}
            <span className="end">dziś</span>
          </div>
          {max === 0 && <Empty className="usage-empty">W ostatnich 14 dniach nie zapisano zużycia{hasMl ? (unit === 'ml' ? ' oleju ani pena' : ' suszu') : ''}.</Empty>}
        </>
      )}
      table={<ul>{series.map((d, k) => <li key={d.day}>{spoken(d, k)}</li>)}</ul>}>
      {/* przełącznik jednostki stoi między nagłówkiem a wykresem, więc jest w dzieciach */}
      {hasMl && (
        <div className="seg usage-unit" role="group" aria-label="Jednostka wykresu">
          {['g', 'ml'].map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => setPick(u)}>{UNIT_NAME[u]} ({u})</button>
          ))}
        </div>
      )}
      <Bars className="usage-chart" width={W} height={H} slot={slot} x0={3} bw={slot - 6} hmax={H - 2} minH={3} zeroH={2} max={max} hit
        role="img" aria-label={`Zużycie ${unit === 'ml' ? 'oleju i pena' : 'suszu'} z ostatnich 14 dni: razem ${num(total)} ${unit}, dziś ${num(series[last].grams)} ${unit}`}
        items={series.map((d, k) => ({ key: d.day, value: d.grams, title: spoken(d, k) }))}
        onSelect={setSel} groupClass={(d, k) => `ubar${k === i ? ' on' : ''}${k === last ? ' is-today' : ''}`} zeroClass="ubar-zero" />
    </Frame>
  );
}
