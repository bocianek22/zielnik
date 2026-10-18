import SymptomStreak from './SymptomStreak';
import BadgeNews from './BadgeNews';
import Icon from './Icon';
import { badgesOf } from '@/lib/badges';

// UI 5 etap 5: karta „Twój tydzień” na ekranie „Dziś” (komponent serwerowy): regularność wpisów, średnie objawów
// z porównaniem do poprzedniego tygodnia i odznaki za porządek. Tylko objawy, nigdy zużycie. Ton spokojny: zmiana
// opisana słowami „niżej/wyżej”, bez czerwieni; nieodblokowane odznaki neutralne, z podpowiedzią, jak je zdobyć.
const pl = (x) => String(x).replace('.', ',');

function Trend({ t }) {
  if (t.diff == null) return <span className="wk-cmp">{t.n > 0 ? `${t.n} ${t.n === 1 ? 'wpis' : t.n < 5 ? 'wpisy' : 'wpisów'}` : ''}</span>;
  if (t.diff === 0) return <span className="wk-cmp">jak tydzień wcześniej</span>;
  return (
    <span className={`wk-cmp${t.better ? ' better' : ''}`}>
      <Icon name="chevronDown" size={14} className={t.diff > 0 ? 'wk-up' : undefined} />
      {pl(Math.abs(t.diff))} {t.diff > 0 ? 'wyżej' : 'niżej'}<span className="sr-only"> niż tydzień wcześniej</span>
    </span>
  );
}

export default function WeekCard({ streak, week }) {
  const badges = badgesOf({ best: streak?.best, total: streak?.total, rx: week?.rx, visits: week?.visits });
  const trends = (week?.trends || []).filter((t) => t.avg != null);
  const got = badges.filter((b) => b.on).length;
  return (
    <section className="card week-card" data-cat="journal" aria-labelledby="week-h">
      <h2 id="week-h" className="wk-title">Twój tydzień</h2>
      <SymptomStreak data={streak} className="streak-home" />
      {trends.length > 0 ? (
        <ul className="wk-trends" aria-label="Średnie z ostatnich 7 dni">
          {trends.map((t) => (
            <li key={t.key}><span className="wk-label">{t.label}</span><b className="wk-avg">{pl(t.avg)}</b><Trend t={t} /></li>
          ))}
        </ul>
      ) : <p className="muted small">Po kilku wpisach objawów zobaczysz tu średnie tygodnia.</p>}
      <h3 className="wk-sub">Odznaki <span className="muted">{got} z {badges.length}</span></h3>
      <ul className="bdgs">
        {badges.map((b) => (
          <li key={b.key} className={`bdg${b.on ? ' on' : ''}`} data-badge={b.key}>
            <span className="bdg-ic" aria-hidden="true"><Icon name={b.on ? b.icon : 'clock'} size={20} /></span>
            <span className="bdg-txt"><b>{b.label}</b><span>{b.on ? 'zdobyta' : b.how}</span></span>
          </li>
        ))}
      </ul>
      <BadgeNews earned={badges.filter((b) => b.on).map((b) => [b.key, b.label])} />
    </section>
  );
}
