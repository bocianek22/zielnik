'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import QuickActions from './QuickActions';
import NoUseToday from './NoUseToday';
import Icon from './Icon';
import SymptomsQuick from './SymptomsQuick';
import UsageDays from './charts/UsageDays';
import StockForecast from './charts/StockForecast';
import { addDays, longDay, num as n2, plural } from './charts/fmt';
import { unitOf } from '@/lib/units';
import { shortcutAction, withoutUseParam } from '@/lib/shortcuts';
import { daysLeft as daysOf } from '@/lib/widget';

// Panel „Dziś” na stronie głównej: zapas i prognoza, zużycie z 14 dni, szybkie „Zużyłem”, szybki wpis objawów, recepty.
// Daty liczy z dni z serwera (czas polski), a nie z zegara przeglądarki, żeby serwer i klient renderowały to samo.
// Gramy (susz) i ml (olej, pen) nigdy się nie sumują: osobny zapas i prognoza, wykres z przełącznikiem jednostki.

const days = (n) => plural(n, 'dzień', 'dni');

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
          const u = r.unit === 'ml' ? 'ml' : 'g';
          return (
            <li key={r.id} className={`trx${expired ? ' expired' : ''}${soon ? ' soon' : ''}`}>
              <div className="trx-count" aria-hidden="true">
                <b>{n}</b>
                <span>{expired ? `${days(n)} temu` : r.days_left === 0 ? 'ost. dzień' : days(n)}</span>
              </div>
              <div className="trx-main">
                <p className="trx-title">
                  {expired
                    ? <>Recepta na {n2(r.grams)} {u} wygasła {n} {days(n)} temu</>
                    : r.days_left === 0 ? <>Recepta na {n2(r.grams)} {u}: ostatni dzień ważności</>
                      : <>Recepta na {n2(r.grams)} {u} wygasa za {n} {days(n)}</>}
                </p>
                <p className="trx-sub">
                  {expired
                    ? <>Niewykorzystane <b>{n2(r.remaining)} {u}</b>, ważna była do {longDay(r.valid_until)}</>
                    : <>Do wykupienia <b>{n2(r.remaining)} {u}</b> z {n2(r.grams)} {u}, ważna do {longDay(r.valid_until)}</>}
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

const notesOf = ({ unit, stock, dailyUse, bought, today }) => {
  const daysLeft = daysOf(stock, dailyUse);
  return [
    dailyUse > 0 && `średnio ${n2(dailyUse)} ${unit} dziennie`,
    daysLeft != null && `do ok. ${longDay(addDays(today, daysLeft))}`,
    bought > 0 && `wykupiono ${n2(bought)} ${unit} w tym miesiącu`,
  ].filter(Boolean);
};

// Dwie jednostki (g i ml): jeden blok z dwiema kolumnami „liczba · dni”; wykresy prognozy (pełna szerokość) i notatki w zwijanym wierszu pod spodem
function StockCell({ unit, stock, dailyUse, ok }) {
  const daysLeft = daysOf(stock, dailyUse);
  const what = unit === 'ml' ? 'oleju i pena' : 'suszu';
  return (
    <div className={`today-stock today-stock-${unit}${ok ? ' ok' : ''}`}>
      <h2 className="kpi-label" id={`today-stock-h-${unit}`}>Zapas {what}</h2>
      <p className="kpi-big"><b>{n2(stock)}</b> {unit}</p>
      <p className="kpi-days-line">starczy na {daysLeft != null ? <b>{daysLeft} {days(daysLeft)}</b> : <b>–</b>}</p>
    </div>
  );
}

// Zapas i prognoza jednej jednostki
function StockBlock({ unit, stock, dailyUse, bought, today, ok, id, range, rx }) {
  const daysLeft = daysOf(stock, dailyUse);
  const notes = notesOf({ unit, stock, dailyUse, bought, today });
  const what = unit === 'ml' ? 'oleju i pena' : '';
  return (
    <div className={`today-stock${ok ? ' ok' : ''}`}>
      <div className="kpi">
        <div>
          <h2 id={id} className="kpi-label">Zapas{what && ` ${what}`}</h2>
          <p className="kpi-big"><b>{n2(stock)}</b> {unit}</p>
        </div>
        <div className="kpi-days">
          <p className="kpi-label">Starczy na</p>
          <p className="kpi-mid">{daysLeft != null ? <><b>{daysLeft}</b> {days(daysLeft)}</> : <b>–</b>}</p>
        </div>
      </div>
      <StockForecast unit={unit} stock={stock} rate={dailyUse} range={range} today={today} rx={rx} what={what} />
      <p className="today-note">
        {notes.length > 0 ? notes.join(' · ') : stock > 0 ? 'Zapisuj zużycie przyciskiem „Zużyłem”, a policzę, na ile dni starczy zapasu.' : 'Brak zapasu. Wpisz stan w karcie odmiany albo zapisz wykup.'}
      </p>
    </div>
  );
}

// stock, dailyUse, bought: { g, ml }; low: próg „Kończy się” w gramach (tylko susz)
export default function TodayPanel({ stock, dailyUse, forecast, bought, low, series, prescriptions, symptoms, noUse = false, quick, onUsed, settings, fresh, hasOwn = false, onAdd }) {
  const today = series.at(-1).day;
  const hasMl = stock.ml > 0 || dailyUse.ml > 0;
  const hasG = !hasMl || stock.g > 0 || dailyUse.g > 0;
  const units = [hasG && 'g', hasMl && 'ml'].filter(Boolean);
  const warnOf = (u) => {
    const d = daysOf(stock[u], dailyUse[u]);
    return stock[u] > 0 && ((u === 'g' && low > 0 && stock[u] <= low) || (d != null && d < 7));
  };
  const warn = units.some(warnOf);
  const comboRows = units.length > 1 ? units.map((u) => ({ u, notes: notesOf({ unit: u, stock: stock[u], dailyUse: dailyUse[u], bought: bought[u], today }) }))
    .filter((r) => r.notes.length > 0 || dailyUse[r.u] > 0) : [];
  const rxOf = (u) => prescriptions.items.find((r) => r.unit === u && r.days_left >= 0); // najbliższa ważna recepta na prognozie
  // POM-38: znacznik „dziś bez zużycia”; dzisiejsze zużycie (serwer zdejmuje wtedy znacznik) zeruje go także tutaj
  const usedToday = Number(series.at(-1).grams) > 0 || Number(series.at(-1).ml) > 0;
  const [noUseOn, setNoUseOn] = useState(noUse);
  useEffect(() => { if (usedToday) setNoUseOn(false); }, [usedToday]);

  // Skróty aplikacji (POM-12): /?zuzylem=1 otwiera „Zużyłem” ostatnio używanej odmiany, /#objawy przewija do objawów.
  // Panel otwieramy dotknięciem przycisku z QuickActions (bez zmiany jego API); bez odmiany z zapasem panelu nie ma
  // i zostaje widok zapasu na górze.
  const root = useRef(null);
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const action = shortcutAction(search, hash);
    if (!action) return;
    if (action === 'use') window.history.replaceState(window.history.state, '', withoutUseParam(pathname, search, hash));
    const target = action === 'use'
      ? root.current?.querySelector('.today-quick .quick-btn[aria-expanded="false"]')
      : document.getElementById('objawy');
    if (!target) return;
    target.scrollIntoView({ block: action === 'use' ? 'center' : 'start' });
    if (action === 'use') target.click();
  }, []);

  // pilne recepty (wygasa w ≤ 7 dni albo wygasła z resztą) nad zapasem, żeby były na pierwszym ekranie
  const rx = prescriptions.items.length > 0 && <Prescriptions items={prescriptions.items} total={prescriptions.total} />;
  return (
    <div className="today" ref={root}>
      {prescriptions.urgent && rx}
      {fresh ? (
        <section className="card empty" aria-labelledby="today-empty-h">
          <Icon name="chart" size={32} />
          <h2 id="today-empty-h">Tu zobaczysz zapas i prognozę</h2>
          <p>{hasOwn ? 'Wpisz, ile masz którejś odmiany, w jej karcie na liście poniżej. Potem przycisk „Zużyłem” policzy, na ile dni starczy zapasu.'
            : 'Dodaj odmianę, którą masz, i jej stan. Potem przycisk „Zużyłem” policzy, na ile dni starczy zapasu.'}</p>
          <button type="button" className="btn" onClick={onAdd}>{hasOwn ? 'Wpisz stan' : 'Dodaj odmianę'}</button>
        </section>
      ) : (
      <section className={`card today-card${warn ? ' warn' : ''}`} aria-labelledby={`today-stock-h-${units[0]}`}>
        {units.length > 1 ? (
          <div className="today-stocks combo">
            <div className="stock-cols">
              {units.map((u) => <StockCell key={u} unit={u} stock={stock[u]} dailyUse={dailyUse[u]} ok={warn && !warnOf(u)} />)}
            </div>
            {comboRows.length > 0 ? (
              <details className="stock-notes">
                <summary>Prognoza i wykupy<Icon name="chevronDown" size={18} /></summary>
                {comboRows.map(({ u, notes }) => (
                  <div key={u} className="stock-notes-unit">
                    {dailyUse[u] > 0 && <StockForecast unit={u} stock={stock[u]} rate={dailyUse[u]} range={forecast?.[u]} today={today} rx={rxOf(u)} what={u === 'ml' ? 'oleju i pena' : 'suszu'} />}
                    {notes.length > 0 && <p className="today-note"><b>{u === 'ml' ? 'Olej i pen' : 'Susz'}:</b> {notes.join(' · ')}</p>}
                  </div>
                ))}
              </details>
            ) : <p className="today-note">Zapisuj zużycie przyciskiem „Zużyłem”, a policzę, na ile dni starczy zapasu.</p>}
          </div>
        ) : (
          <div className="today-stocks">
            {units.map((u) => (
              <StockBlock key={u} id={`today-stock-h-${u}`} unit={u} stock={stock[u]} dailyUse={dailyUse[u]} bought={bought[u]}
                today={today} ok={warn && !warnOf(u)} range={forecast?.[u]} rx={rxOf(u)} />
            ))}
          </div>
        )}

        {quick && (
          <div className="today-quick">
            <div className="tq-name">
              <span className="kpi-label">Ostatnio używana</span>
              <span className="tq-strain"><span className="dn">{quick.name}</span><span className="tq-stock">, mam {n2(quick.current)} {unitOf(quick.form)}</span></span>
            </div>
            <QuickActions key={quick.id} idPrefix="today-q" buy={false} strainId={quick.id} name={quick.name} form={quick.form} current={quick.current}
              remaining={0} onSaved={(en) => onUsed(quick.id, en)} />
          </div>
        )}

        {/* POM-38: tylko gdy dziś nie zapisano zużycia (zapis „Zużyłem” zdejmuje znacznik na serwerze) */}
        {!usedToday && <NoUseToday day={today} on={noUseOn} setOn={setNoUseOn} />}

        <UsageDays series={series} />

        {settings}
      </section>
      )}

      <SymptomsQuick day={today} initial={symptoms} />

      {!prescriptions.urgent && rx}

    </div>
  );
}
