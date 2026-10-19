import Link from 'next/link';
import Icon from './Icon';
import { longDay, num } from './charts/fmt';

// „Przed wizytą” na ekranie „Dziś” (komponent serwerowy, dane z lib/visit-prep.js): pojawia się tylko, gdy w dzienniku
// wizyt jest wizyta w ciągu 7 dni. Średnie objawów od ostatniej wizyty, punkty „Do omówienia” i gotowy raport za ten okres.
// Ton jak w „Twój tydzień”: zmiana słowami „niżej/wyżej”, bez czerwieni.
const pl = (x) => String(x).replace('.', ',');
const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? few : many);

function Trend({ t }) {
  if (t.diff == null) return <span className="wk-cmp">{`${t.n} ${plural(t.n, 'wpis', 'wpisy', 'wpisów')}`}</span>;
  if (t.diff === 0) return <span className="wk-cmp">bez zmian</span>;
  return (
    <span className={`wk-cmp${t.better ? ' better' : ''}`}>
      <Icon name="chevronDown" size={14} className={t.diff > 0 ? 'wk-up' : undefined} />
      {pl(Math.abs(t.diff))} {t.diff > 0 ? 'wyżej' : 'niżej'}<span className="sr-only"> niż wcześniej</span>
    </span>
  );
}

export default function VisitPrepCard({ prep }) {
  if (!prep) return null;
  const when = prep.daysTo === 0 ? 'dziś' : prep.daysTo === 1 ? 'jutro' : `za ${prep.daysTo} dni`;
  const trends = prep.trends.filter((t) => t.avg != null);
  // „okres=wizyta” wpisuje „from” jako datę ostatniej wizyty w raporcie: tylko gdy okres naprawdę zaczyna się od wizyty
  const fromVisit = prep.last && prep.since === prep.last;
  const report = `/raport?from=${prep.since}&to=${prep.today}${fromVisit ? '&okres=wizyta' : ''}`;
  return (
    <section className="card visit-prep" data-cat="learn" aria-labelledby="vp-h">
      <p className="vp-kicker"><span className="ic-dot sm"><Icon name="clipboard" size={18} /></span>Przed wizytą</p>
      <h2 id="vp-h" className="vp-title">Wizyta {when}<span className="vp-date">{longDay(prep.next)}</span></h2>
      <p className="vp-period">
        {fromVisit ? <>Od ostatniej wizyty ({longDay(prep.last)})</> : <>Od {longDay(prep.since)}</>}: {prep.days} {plural(prep.days, 'dzień', 'dni', 'dni')} z wpisami objawów
      </p>
      {trends.length > 0 && (
        <ul className="wk-trends vp-trends" aria-label="Średnie objawów w tym okresie">
          {trends.map((t) => (
            <li key={t.key}><span className="wk-label">{t.label}</span><b className="wk-avg">{pl(t.avg)}</b><Trend t={t} /></li>
          ))}
        </ul>
      )}
      {prep.measures?.length > 0 && (
        <div className="vp-measures">
          <p className="vp-mhead" id="vp-mh">Pomiary: ostatni, w nawiasie zmiana od pierwszego w tym okresie</p>
          <ul aria-labelledby="vp-mh">
            {prep.measures.map((m) => (
              <li key={m.name}><span className="dn">{m.name}</span> <b>{num(m.last)}{m.unit && ` ${m.unit}`}</b>
                {m.diff != null && <span className="muted"> ({m.diff === 0 ? 'bez zmian' : `${m.diff > 0 ? '+' : '−'}${num(Math.abs(m.diff))}${m.unit ? ` ${m.unit}` : ''}`})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {prep.report && <>
        <p className="vp-notes">
          <Icon name="file" size={16} />
          {prep.notes > 0
            ? <>Do omówienia: <b>{prep.notes} {plural(prep.notes, 'punkt', 'punkty', 'punktów')}</b></>
            : <>Nie masz jeszcze pytań do lekarza.</>}
        </p>
        <div className="vp-actions">
          <Link className="btn" href={report}>Raport za ten okres</Link>
          <Link className="btn ghost" href="/raport#dn-h">{prep.notes > 0 ? 'Pytania' : 'Dodaj pytanie'}</Link>
        </div>
      </>}
    </section>
  );
}
