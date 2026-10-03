'use client';
import Link from 'next/link';
import { useState } from 'react';
import QuickActions from './QuickActions';
import Icon from './Icon';
import SymptomsQuick from './SymptomsQuick';

// Panel „Dziś” na stronie głównej: zapas i prognoza, zużycie z 14 dni, szybkie „Zużyłem”, szybki wpis objawów, recepty.
// Daty liczy z dni z serwera (czas polski), a nie z zegara przeglądarki, żeby serwer i klient renderowały to samo.

const HORIZON = 30; // pełny miernik = zapas na 30 dni
const WD = ['niedz.', 'pon.', 'wt.', 'śr.', 'czw.', 'pt.', 'sob.'];
const n2 = (x) => Number(Number(x).toFixed(2)).toLocaleString('pl-PL');
const days = (n) => (n === 1 ? 'dzień' : 'dni');
const utc = (day) => new Date(`${day}T12:00:00Z`);
const ddmm = (day) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const longDate = (d) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const addDays = (day, n) => { const d = utc(day); d.setUTCDate(d.getUTCDate() + n); return d; };

// słupek z zaokrągloną górą (4 px), zakotwiczony do linii bazowej
function barPath(x, w, h, base) {
  const r = Math.min(4, h, w / 2);
  const y = base - h;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${base}Z`;
}

function UsageChart({ series }) {
  const last = series.length - 1;
  const [sel, setSel] = useState(last);
  const i = Math.min(sel, last);
  const max = Math.max(...series.map((d) => d.grams), 0);
  const total = series.reduce((a, d) => a + d.grams, 0);
  const W = 280, H = 76, slot = W / series.length, bw = slot - 6;
  const label = (k) => (k === last ? 'Dziś' : k === last - 1 ? 'Wczoraj' : `${WD[utc(series[k].day).getUTCDay()]} ${ddmm(series[k].day)}`);
  const spoken = (d, k) => `${k === last ? 'dziś' : longDate(utc(d.day))}: ${n2(d.grams)} g`;

  return (
    <div className="usage">
      <div className="usage-head">
        <h3 className="today-h">Zużycie, 14 dni</h3>
        <p className="usage-sel" aria-live="polite"><span>{label(i)}</span> <b>{n2(series[i].grams)} g</b></p>
      </div>
      <svg className="usage-chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Zużycie z ostatnich 14 dni: razem ${n2(total)} g, dziś ${n2(series[last].grams)} g`}>
        {series.map((d, k) => {
          const x = k * slot + 3;
          const h = max > 0 && d.grams > 0 ? Math.max(3, (d.grams / max) * (H - 2)) : 0;
          return (
            <g key={d.day} className={`ubar${k === i ? ' on' : ''}${k === last ? ' is-today' : ''}`} onClick={() => setSel(k)}>
              <title>{spoken(d, k)}</title>
              <rect x={k * slot} y="0" width={slot} height={H} fill="transparent" />
              {h > 0 ? <path d={barPath(x, bw, h, H)} /> : <rect className="ubar-zero" x={x} y={H - 2} width={bw} height="2" rx="1" />}
            </g>
          );
        })}
      </svg>
      <div className="usage-axis" aria-hidden="true">
        <span>{ddmm(series[0].day)}</span>
        {last >= 7 && <span className="mid" style={{ left: `${((last - 7 + 0.5) / series.length) * 100}%` }}>{ddmm(series[last - 7].day)}</span>}
        <span className="end">dziś</span>
      </div>
      {max === 0 && <p className="usage-empty">W ostatnich 14 dniach nie zapisano zużycia.</p>}
      <ul className="sr-only">{series.map((d, k) => <li key={d.day}>{spoken(d, k)}</li>)}</ul>
    </div>
  );
}

function Prescriptions({ items, total }) {
  const shown = items.slice(0, 3);
  return (
    <section className="card today-rx" aria-labelledby="today-rx-h">
      <div className="today-card-head">
        <h2 id="today-rx-h" className="today-h">Recepty</h2>
        <Link className="btn text small" href="/recepty">{total > shown.length ? `Wszystkie (${total})` : 'Wszystkie'}<Icon name="chevronRight" size={18} /></Link>
      </div>
      <ul className="trx-list">
        {shown.map((r) => {
          const expired = r.days_left < 0;
          const n = Math.abs(r.days_left);
          const soon = !expired && r.days_left <= 7;
          const pct = Math.min(100, (r.bought / r.grams) * 100);
          return (
            <li key={r.id} className={`trx${expired ? ' expired' : ''}${soon ? ' soon' : ''}`}>
              <div className="trx-count" aria-hidden="true">
                <b>{n}</b>
                <span>{expired ? `${days(n)} temu` : r.days_left === 0 ? 'ost. dzień' : days(n)}</span>
              </div>
              <div className="trx-main">
                <p className="trx-title">
                  {expired
                    ? <>Recepta na {n2(r.grams)} g wygasła {n} {days(n)} temu</>
                    : r.days_left === 0 ? <>Recepta na {n2(r.grams)} g: ostatni dzień ważności</>
                      : <>Recepta na {n2(r.grams)} g wygasa za {n} {days(n)}</>}
                </p>
                <p className="trx-sub">
                  {expired
                    ? <>Niewykorzystane <b>{n2(r.remaining)} g</b>, ważna była do {longDate(utc(r.valid_until))}</>
                    : <>Do wykupienia <b>{n2(r.remaining)} g</b> z {n2(r.grams)} g, ważna do {longDate(utc(r.valid_until))}</>}
                </p>
                {!expired && <div className="trx-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function TodayPanel({ stock, dailyUse, boughtG, low, series, prescriptions, symptoms, quick, onUsed, settings }) {
  const today = series.at(-1).day;
  const daysLeft = dailyUse > 0 && stock > 0 ? Math.floor(stock / dailyUse) : null;
  const warn = stock > 0 && ((low > 0 && stock <= low) || (daysLeft != null && daysLeft < 7));
  const pct = daysLeft != null ? Math.min(daysLeft / HORIZON, 1) * 100 : 0;
  const notes = [
    dailyUse > 0 && `średnio ${n2(dailyUse)} g dziennie`,
    daysLeft != null && `do ok. ${longDate(addDays(today, daysLeft))}`,
    boughtG > 0 && `wykupiono ${n2(boughtG)} g w tym miesiącu`,
  ].filter(Boolean);

  // pilne recepty (wygasa w ≤ 7 dni albo wygasła z resztą) nad zapasem, żeby były na pierwszym ekranie
  const rx = prescriptions.items.length > 0 && <Prescriptions items={prescriptions.items} total={prescriptions.total} />;
  return (
    <div className="today">
      {prescriptions.urgent && rx}
      <section className={`card today-card${warn ? ' warn' : ''}`} aria-labelledby="today-stock-h">
        <div className="today-stock">
          <div className="kpi">
            <div>
              <h2 id="today-stock-h" className="kpi-label">Zapas</h2>
              <p className="kpi-big"><b>{n2(stock)}</b> g</p>
            </div>
            <div className="kpi-days">
              <p className="kpi-label">Starczy na</p>
              <p className="kpi-mid">{daysLeft != null ? <><b>{daysLeft}</b> {days(daysLeft)}</> : <b>–</b>}</p>
            </div>
          </div>
          {daysLeft != null ? (
            <div className="gauge" role="meter" aria-label="Zapas w dniach (pełny pasek: 30 dni)" aria-valuemin={0} aria-valuemax={HORIZON}
              aria-valuenow={Math.min(daysLeft, HORIZON)} aria-valuetext={`${daysLeft} ${days(daysLeft)}`}>
              <span style={{ width: `${pct}%` }} />
              <i style={{ left: `${(7 / HORIZON) * 100}%` }} /><i style={{ left: `${(14 / HORIZON) * 100}%` }} />
            </div>
          ) : (
            <div className="gauge empty" aria-hidden="true" />
          )}
          {daysLeft != null && <div className="gauge-scale" aria-hidden="true"><span>0</span><span className="mid" style={{ left: `${(7 / HORIZON) * 100}%` }}>7</span>
            <span className="mid" style={{ left: `${(14 / HORIZON) * 100}%` }}>14</span><span className="end">30 dni</span></div>}
          <p className="today-note">
            {notes.length > 0 ? notes.join(' · ') : stock > 0 ? 'Zapisuj zużycie przyciskiem „Zużyłem”, a policzę, na ile dni starczy zapasu.' : 'Brak zapasu. Wpisz stan w karcie odmiany albo zapisz wykup.'}
          </p>
        </div>

        <UsageChart series={series} />

        {quick && (
          <div className="today-quick">
            <div className="tq-name">
              <span className="kpi-label">Ostatnio używana</span>
              <span className="tq-strain"><span className="dn">{quick.name}</span><span className="tq-stock">, mam {n2(quick.current)} g</span></span>
            </div>
            <QuickActions key={quick.id} idPrefix="today-q" buy={false} strainId={quick.id} name={quick.name} current={quick.current}
              remaining={0} onSaved={(en) => onUsed(quick.id, en)} />
          </div>
        )}

        {settings}
      </section>

      <SymptomsQuick day={today} initial={symptoms} />

      {!prescriptions.urgent && rx}

    </div>
  );
}
