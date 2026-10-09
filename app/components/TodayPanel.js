'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import NoUseToday from './NoUseToday';
import Icon from './Icon';
import SymptomsQuick from './SymptomsQuick';
import UsageDays from './charts/UsageDays';
import StockForecast from './charts/StockForecast';
import { addDays, ddmm, longDay, num as n2, plural } from './charts/fmt';
import { shortcutAction, withoutUseParam } from '@/lib/shortcuts';
import { daysLeft as daysOf } from '@/lib/widget';

// Panel „Dziś” pod nagłówkiem (hero z zapasem i „Zużyłem” jest w TodayBoard.js): kafle, wykres 14 dni z prognozą, „Do zrobienia”, szybki wpis objawów, recepty.
// Daty liczy z dni z serwera (czas polski), a nie z zegara przeglądarki, żeby serwer i klient renderowały to samo.
// Gramy (susz) i ml (olej, pen) nigdy się nie sumują: osobny zapas i prognoza, wykres z przełącznikiem jednostki.

const days = (n) => plural(n, 'dzień', 'dni');

// jednostki panelu: g i ml nigdy się nie sumują; susz pierwszy
export const unitsOf = (stock, dailyUse) => {
  const hasMl = stock.ml > 0 || dailyUse.ml > 0;
  const hasG = !hasMl || stock.g > 0 || dailyUse.g > 0;
  return [hasG && 'g', hasMl && 'ml'].filter(Boolean);
};
// zapas jednostki „kończy się”: poniżej progu (tylko susz) albo starczy na mniej niż 7 dni
const warnOf = (u, stock, dailyUse, low) => {
  const d = daysOf(stock[u], dailyUse[u]);
  return stock[u] > 0 && ((u === 'g' && low > 0 && stock[u] <= low) || (d != null && d < 7));
};
const what = (u) => (u === 'ml' ? 'oleju i pena' : 'suszu');

function Prescriptions({ items, total }) {
  const shown = items.slice(0, 3);
  return (
    <section className="card today-rx" data-cat="rx" aria-labelledby="today-rx-h">
      <div className="sec-head">
        <span className="ic-dot"><Icon name="file" size={22} /></span>
        <h2 id="today-rx-h">Recepty</h2>
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

// Kafel KPI: cały jest linkiem (kotwica #… na tej stronie, reszta przez Link)
function Tile({ href, cat, solid, warn, icon, label, value, sub }) {
  const props = { className: `kpi-tile${solid ? ' solid' : ''}${warn ? ' warn' : ''}`, 'data-cat': cat };
  const body = (
    <>
      <span className="kt-label"><span className="ic-dot sm"><Icon name={icon} size={20} /></span>{label}</span>
      <span className="kt-value">{value}</span>
      <span className="kt-sub">{sub}</span>
    </>
  );
  return href.startsWith('#') ? <a href={href} {...props}>{body}</a> : <Link href={href} {...props}>{body}</Link>;
}

function Todo({ items }) {
  return (
    <section className="today-todo" aria-labelledby="todo-h">
      <h2 id="todo-h" className="sec-label">Do zrobienia</h2>
      <ul className="card todo">
        {items.map((t) => {
          const body = (
            <>
              <span className={`ic-dot sq${t.warn ? ' warn' : ''}`} data-cat={t.cat}><Icon name={t.icon} size={22} /></span>
              <span className="todo-main"><b>{t.title}</b><span>{t.sub}</span></span>
              <Icon name="chevronRight" size={20} />
            </>
          );
          return <li key={t.key}>{t.href.startsWith('#') ? <a href={t.href} className="todo-row">{body}</a> : <Link href={t.href} className="todo-row">{body}</Link>}</li>;
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

const SYM_CORE = ['pain', 'sleep', 'anxiety', 'mood'];

// stock, dailyUse, bought: { g, ml }; low: próg „Kończy się” w gramach (tylko susz); lowStrain: { name, current, unit } | null
export default function TodayPanel({ stock, dailyUse, forecast, bought, low, series, prescriptions, symptoms, noUse = false, lowStrain = null, settings, fresh, hasOwn = false, onAdd }) {
  const today = series.at(-1).day;
  const units = unitsOf(stock, dailyUse);
  const u1 = units[0];
  const warnU = units.find((u) => warnOf(u, stock, dailyUse, low));
  const rxOf = (u) => prescriptions.items.find((r) => r.unit === u && r.days_left >= 0); // najbliższa ważna recepta na prognozie
  const rows = units.map((u) => ({ u, notes: notesOf({ unit: u, stock: stock[u], dailyUse: dailyUse[u], bought: bought[u], today }) }))
    .filter((r) => r.notes.length > 0 || dailyUse[r.u] > 0);
  // POM-38: znacznik „dziś bez zużycia”; dzisiejsze zużycie (serwer zdejmuje wtedy znacznik) zeruje go także tutaj
  const usedToday = Number(series.at(-1).grams) > 0 || Number(series.at(-1).ml) > 0;
  const [noUseOn, setNoUseOn] = useState(noUse);
  useEffect(() => { if (usedToday) setNoUseOn(false); }, [usedToday]);
  // dzisiejsze objawy na żywo (szybki wpis zgłasza każdą zmianę): kafel nastroju i zadanie „Wpisz objawy”
  const [sym, setSym] = useState(symptoms);

  // Skróty aplikacji (POM-12): /?zuzylem=1 otwiera „Zużyłem” ostatnio używanej odmiany (przycisk jest w nagłówku strony),
  // /#objawy przewija do objawów. Bez odmiany z zapasem przycisku nie ma i zostaje widok zapasu na górze.
  useEffect(() => {
    const { pathname, search, hash } = window.location;
    const action = shortcutAction(search, hash);
    if (!action) return;
    if (action === 'use') window.history.replaceState(window.history.state, '', withoutUseParam(pathname, search, hash));
    const target = action === 'use'
      ? document.querySelector('.today-quick .quick-btn[aria-expanded="false"]')
      : document.getElementById('objawy');
    if (!target) return;
    target.scrollIntoView({ block: action === 'use' ? 'center' : 'start' });
    if (action === 'use') target.click();
  }, []);

  const rx0 = prescriptions.items[0];
  const rxU = (r) => (r.unit === 'ml' ? 'ml' : 'g');
  const filled = SYM_CORE.filter((k) => sym?.[k] != null).length;
  const parts = [['sen', sym?.sleep], ['ból', sym?.pain], ['lęk', sym?.anxiety]].filter(([, v]) => v != null).map(([k, v]) => `${k} ${v}`);
  const usedNow = u1 === 'ml' ? Number(series.at(-1).ml) || 0 : Number(series.at(-1).grams) || 0;
  const daysWarn = warnU && daysOf(stock[warnU], dailyUse[warnU]);
  const reason = lowStrain || warnU;

  const tiles = [
    // recepta: pełny kafel tylko gdy jest ważna recepta z resztą do wykupienia
    rx0 && rx0.days_left >= 0
      ? <Tile key="rx" href="/recepty" cat="rx" solid icon="file" label="Recepta" value={<>{rx0.days_left}<small>{days(rx0.days_left)}</small></>}
        sub={rx0.days_left === 0 ? 'ostatni dzień ważności' : `zostało ${n2(rx0.remaining)} ${rxU(rx0)}, do ${ddmm(rx0.valid_until)}`} />
      : rx0
        ? <Tile key="rx" href="/recepty" cat="rx" icon="file" label="Recepta" value={<>{Math.abs(rx0.days_left)}<small>{days(Math.abs(rx0.days_left))} po terminie</small></>}
          sub={`niewykorzystane ${n2(rx0.remaining)} ${rxU(rx0)}`} />
        : <Tile key="rx" href="/recepty" cat="rx" icon="file" label="Recepta" value="–" sub="Dodaj receptę" />,
    sym?.mood != null
      ? <Tile key="mood" href="/dziennik" cat="journal" solid icon="smile" label="Nastrój" value={<>{sym.mood}<small>/10</small></>} sub={parts.length ? parts.join(' · ') : 'dziś w dzienniku'} />
      : <Tile key="mood" href="#objawy" cat="journal" icon="smile" label="Nastrój" value="–" sub={parts.length ? parts.join(' · ') : 'Wpisz objawy dnia'} />,
    <Tile key="today" href="/historia" cat="stock" icon="chart" label="Dziś zużyto"
      value={<>{n2(usedNow)}<small>{u1}</small></>}
      sub={noUseOn && !usedToday ? 'oznaczone: bez zużycia' : dailyUse[u1] > 0 ? `średnio ${n2(dailyUse[u1])} ${u1}` : 'jeszcze bez średniej'} />,
    reason
      ? <Tile key="low" href="/odmiany" warn icon="alert" label="Kończy się"
        value={lowStrain ? <>{n2(lowStrain.current)}<small>{lowStrain.unit}</small></> : <>{n2(stock[warnU])}<small>{warnU}</small></>}
        sub={lowStrain ? <span className="dn">{lowStrain.name}</span> : daysWarn != null ? `starczy na ${daysWarn} ${days(daysWarn)}` : `zapas ${what(warnU)}`} />
      : bought[u1] > 0
        ? <Tile key="buy" href="/recepty" cat="rx" icon="cart" label="Wykupiono" value={<>{n2(bought[u1])}<small>{u1}</small></>} sub="w tym miesiącu" />
        : <Tile key="avg" href="/historia" cat="stock" icon="trend" label="Średnio dziennie"
          value={dailyUse[u1] > 0 ? <>{n2(dailyUse[u1])}<small>{u1}</small></> : '–'} sub={dailyUse[u1] > 0 ? 'z ostatnich 30 dni' : 'po pierwszych zapisach'} />,
  ];

  const urgentRx = prescriptions.items.find((r) => r.urgent);
  const todo = [
    urgentRx && (urgentRx.days_left < 0
      ? { key: 'rx', cat: 'rx', icon: 'file', title: 'Recepta wygasła', sub: `Niewykorzystane ${n2(urgentRx.remaining)} ${rxU(urgentRx)}`, href: '/recepty' }
      : { key: 'rx', cat: 'rx', icon: 'file', title: urgentRx.days_left === 0 ? 'Recepta wygasa dziś' : `Recepta wygasa za ${urgentRx.days_left} ${days(urgentRx.days_left)}`,
        sub: `Do wykupienia ${n2(urgentRx.remaining)} ${rxU(urgentRx)}`, href: '/recepty' }),
    reason && { key: 'low', cat: 'stock', warn: true, icon: 'alert', title: 'Kończy się zapas',
      sub: lowStrain ? <><span className="dn">{lowStrain.name}</span>: {n2(lowStrain.current)} {lowStrain.unit}</> : daysWarn != null ? `Zapas ${what(warnU)} starczy na ${daysWarn} ${days(daysWarn)}` : `Zapas ${what(warnU)}: ${n2(stock[warnU])} ${warnU}`, href: '/odmiany' },
    filled < SYM_CORE.length && { key: 'sym', cat: 'journal', icon: 'pulse', title: filled ? 'Uzupełnij objawy dnia' : 'Wpisz objawy dnia',
      sub: filled ? `Zapisano ${filled} z ${SYM_CORE.length}` : 'Jedno dotknięcie zapisuje wpis', href: '#objawy' },
  ].filter(Boolean);

  const rx = prescriptions.items.length > 0 && <Prescriptions items={prescriptions.items} total={prescriptions.total} />;
  return (
    <div className={`today${fresh ? ' fresh' : ''}`}>
      {fresh ? (
        <section className="card empty" aria-labelledby="today-empty-h">
          <Icon name="chart" size={32} />
          <h2 id="today-empty-h">Tu zobaczysz zapas i prognozę</h2>
          <p>{hasOwn ? 'Wpisz, ile masz którejś odmiany, w jej karcie na liście poniżej. Potem przycisk „Zużyłem” policzy, na ile dni starczy zapasu.'
            : 'Dodaj odmianę, którą masz, i jej stan. Potem przycisk „Zużyłem” policzy, na ile dni starczy zapasu.'}</p>
          <button type="button" className="btn" onClick={onAdd}>{hasOwn ? 'Wpisz stan' : 'Dodaj odmianę'}</button>
        </section>
      ) : (
        <>
          <div className="kpi-grid">{tiles}</div>

          <section className="card today-chart" data-cat="stock" aria-labelledby="usage-h">
            <UsageDays series={series} />
            {/* POM-38: tylko gdy dziś nie zapisano zużycia (zapis „Zużyłem” zdejmuje znacznik na serwerze) */}
            {!usedToday && <NoUseToday day={today} on={noUseOn} setOn={setNoUseOn} />}
            <div className="stock-lead">
              {units.map((u) => {
                const d = daysOf(stock[u], dailyUse[u]);
                return <p key={u} className={warnU === u ? 'low' : undefined}><span>Zapas {what(u)}</span> <b>{n2(stock[u])} {u}</b>{d != null && <>, starczy na <b>{d} {days(d)}</b></>}</p>;
              })}
            </div>
            {rows.length > 0 ? (
              <details className="stock-notes">
                <summary>Prognoza i wykupy<Icon name="chevronDown" size={18} /></summary>
                {rows.map(({ u, notes }) => (
                  <div key={u} className="stock-notes-unit">
                    {dailyUse[u] > 0 && <StockForecast unit={u} stock={stock[u]} rate={dailyUse[u]} range={forecast?.[u]} today={today} rx={rxOf(u)} what={what(u)} />}
                    {notes.length > 0 && <p className="today-note">{units.length > 1 && <b>{u === 'ml' ? 'Olej i pen' : 'Susz'}: </b>}{notes.join(' · ')}</p>}
                  </div>
                ))}
              </details>
            ) : <p className="today-note">Zapisuj zużycie przyciskiem „Zużyłem”, a policzę, na ile dni starczy zapasu.</p>}
          </section>

          {todo.length > 0 && <Todo items={todo} />}
        </>
      )}

      <SymptomsQuick day={today} initial={symptoms} onChange={setSym} />

      {rx}

      {!fresh && <section className="card prefs-card">{settings}</section>}
    </div>
  );
}
