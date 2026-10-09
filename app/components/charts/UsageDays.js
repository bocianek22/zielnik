'use client';
import { useState } from 'react';
import Frame from './Frame';
import Bars from './Bars';
import Scrub from './Scrub';
import Empty from './Empty';
import { layoutLabels } from './labels';
import { niceTicks } from './scale';
import { ddmm, longDay, num, weekday } from './fmt';

// Zużycie z 14 dni w panelu „Dziś”. Gramy (susz) i ml (olej, pen) nigdy się nie sumują: wykres z przełącznikiem jednostki.
// Daty z dni z serwera (czas polski), nie z zegara przeglądarki, żeby serwer i klient renderowały to samo.
// Słupki 60% przedziału; liczba tylko przy najwyższym, jedna linia siatki z podpisem, linia średniej z 14 dni. Dotyk i strzałki
// przez Scrub (odczyt w nagłówku, aria-live), wartości z pozostałych dni w tabeli dla czytnika.
const UNIT_NAME = { g: 'Susz', ml: 'Olej i pen' };
const W = 326, H = 80, HMAX = 62; // 18 px nad najwyższym słupkiem zostaje na jego liczbę

export default function UsageDays({ series: raw }) {
  const sumOf = (k) => raw.reduce((a, d) => a + (Number(d[k]) || 0), 0);
  const hasMl = sumOf('ml') > 0;
  // domyślnie gramy; same wpisy w ml (bez suszu) od razu pokazują ml
  const [pick, setPick] = useState(null);
  const unit = pick ?? (hasMl && !(sumOf('grams') > 0) ? 'ml' : 'g');
  const key = unit === 'ml' ? 'ml' : 'grams';
  const series = raw.map((d) => ({ day: d.day, grams: Number(d[key]) || 0 }));
  const n = series.length, last = n - 1;
  // sel: wybrany dzień (null = nic nie wybrano, odczyt pokazuje dziś, a słupki mają pełny kolor)
  const [sel, setSel] = useState(null);
  const i = sel == null ? last : Math.min(sel, last);
  const max = Math.max(...series.map((d) => d.grams), 0);
  const total = series.reduce((a, d) => a + d.grams, 0);
  const avg = n > 0 ? total / n : 0;
  const top = niceTicks(max, 2).at(-1); // szczyt skali: „ładna” wartość nie mniejsza niż max
  const slot = W / n, bw = slot * 0.6;
  const yOf = (v) => H - (v / top) * HMAX;
  const peak = max > 0 ? series.findIndex((d) => d.grams === max) : -1;
  const grid = max > 0 ? niceTicks(max, 2).slice(1) : [];
  const label = (k) => (k === last ? 'Dziś' : k === last - 1 ? 'Wczoraj' : `${weekday(series[k].day)} ${ddmm(series[k].day)}`);
  const spoken = (d, k) => `${k === last ? 'dziś' : longDay(d.day)}: ${num(d.grams)} ${unit}`;
  const pct = (k) => `${((k + 0.5) / n) * 100}%`;

  // podpisy osi: pierwszy dzień, poniedziałki i „dziś” (pierwszeństwo: dziś, potem pierwszy dzień), nachodzące są pomijane
  const ticks = layoutLabels(series.map((d, k) => ({
    key: d.day, x: (k + 0.5) * slot, prio: k === last ? 3 : k === 0 ? 2 : 1,
    text: k === last ? 'dziś' : ddmm(d.day), strong: k === last,
  })).filter((t, k) => k === 0 || k === last || weekday(series[k].day) === 'pon.'), W, { rows: 1 });

  return (
    <Frame className="usage" headClass="usage-head" title="Zużycie, 14 dni" titleClass="today-h" readClass="usage-sel"
      read={<><span>{label(i)}</span> <b>{num(series[i].grams)} {unit}</b></>}
      axis={(
        <>
          <div className="usage-axis" aria-hidden="true">
            {ticks.map((t) => (
              <span key={t.key} className={`fc-lbl ${t.side}${t.strong ? ' strong' : ''}`} style={t.side === 'c' ? { left: `${(t.x / W) * 100}%` } : undefined}>{t.text}</span>
            ))}
          </div>
          {max > 0 && <p className="usage-key"><i aria-hidden="true" />średnio {num(avg)} {unit} dziennie</p>}
          {max === 0 && <Empty className="usage-empty">W ostatnich 14 dniach nie zapisano zużycia{hasMl ? (unit === 'ml' ? ' oleju ani pena' : ' suszu') : ''}.</Empty>}
        </>
      )}
      table={<ul>{series.map((d, k) => <li key={d.day}>{spoken(d, k)}</li>)}</ul>}>
      {/* przełącznik jednostki stoi między nagłówkiem a wykresem, więc jest w dzieciach */}
      {hasMl && (
        <div className="seg usage-unit" role="group" aria-label="Jednostka wykresu">
          {['g', 'ml'].map((u) => (
            <button key={u} type="button" aria-pressed={unit === u} className={unit === u ? 'on' : ''} onClick={() => { setPick(u); setSel(null); }}>{UNIT_NAME[u]} ({u})</button>
          ))}
        </div>
      )}
      <Scrub className="usage-scrub" n={n} sel={sel} onSel={setSel}
        label={`Zużycie ${unit === 'ml' ? 'oleju i pena' : 'suszu'} z ostatnich 14 dni: razem ${num(total)} ${unit}, dziś ${num(series[last].grams)} ${unit}. Strzałkami wybierzesz dzień.`}>
        <Bars className="usage-svg" width={W} height={H} slot={slot} x0={(slot - bw) / 2} bw={bw} hmax={HMAX} minH={3} zeroH={2} max={top}
          preserveAspectRatio="none" aria-hidden="true" items={series.map((d) => ({ key: d.day, value: d.grams }))}
          groupClass={(d, k) => `ubar${k === i && sel != null ? ' on' : ''}${k === last ? ' is-today' : ''}`} zeroClass="ubar-zero">
          {grid.map((t) => <line key={t} className="usage-grid" x1="0" x2={W} y1={yOf(t)} y2={yOf(t)} />)}
          <line className="usage-base" x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} />
        </Bars>
        {max > 0 && <i className="usage-avg" style={{ top: yOf(avg) }} aria-hidden="true" />}
        {grid.map((t) => {
          // podpis siatki po prawej; przy najwyższym słupku blisko prawej krawędzi ustępuje jego liczbie
          const clash = peak >= n - 3 && Math.abs(yOf(max) - yOf(t)) < 14;
          return !clash && <span key={t} className="usage-tick" style={{ top: yOf(t) }} aria-hidden="true">{num(t)} {unit}</span>;
        })}
        {peak >= 0 && <span className="usage-peak" style={{ left: pct(peak), top: yOf(max) }} aria-hidden="true">{num(max)}</span>}
      </Scrub>
    </Frame>
  );
}
