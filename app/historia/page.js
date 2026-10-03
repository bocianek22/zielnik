import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { history, monthlyRecap, purchaseStats } from '@/lib/strains';
import Header from '../components/Header';
import Icon from '../components/Icon';
import Entries from './Entries';

export const dynamic = 'force-dynamic';

const nf = (n, max = 1) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Empty({ icon, title, text }) {
  return (
    <div className="card empty">
      <Icon name={icon} size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="btn ghost" href="/">Przejdź do odmian</Link>
    </div>
  );
}

export default async function Historia() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [{ purchases, usage, weekly, top }, recap, bought] = await Promise.all([
    history(user.id), monthlyRecap(user.id), purchaseStats(user.id),
  ]);
  // wykres tygodniowy: gramy suszu; ml (olej, pen) osobną serią tylko gdy są wpisy w ml
  const hasMl = weekly.some((w) => w.ml > 0);
  const chartUnit = hasMl && !weekly.some((w) => w.grams > 0) ? 'ml' : 'g';
  const wk = (w) => (chartUnit === 'ml' ? w.ml : w.grams);
  const max = Math.max(1, ...weekly.map(wk));
  const monthLabel = cap(new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }));
  const hasRecap = recap.totalGrams > 0 || recap.totalMl > 0 || recap.ratedCount > 0 || bought.grams > 0 || bought.ml > 0;
  const weeklyTotal = weekly.reduce((a, w) => a + wk(w), 0);
  const peak = weekly.reduce((a, w) => (wk(w) > wk(a) ? w : a), weekly[0] || { grams: 0, ml: 0, label: '' });
  const unitWord = chartUnit === 'ml' ? 'mililitrach' : 'gramach';
  const chartLabel = `Zużycie tygodniowe w ${unitWord}, ostatnie ${weekly.length} tygodni: razem ${nf(weeklyTotal)} ${chartUnit}, najwięcej ${nf(wk(peak))} ${chartUnit} w tygodniu od ${peak.label}.`;
  const mlWeeks = chartUnit === 'g' && hasMl ? weekly.filter((w) => w.ml > 0) : [];

  return (
    <>
      <Header user={user} />
      <main className="page hist-page">
        <h1>Historia</h1>
        {hasRecap && (
          <>
            <h2 className="section-label">Twój miesiąc: {monthLabel}</h2>
            <section className="card recap summary">
              <dl className="stat-strip">
                <div><dt>Zużyte</dt><dd>{recap.totalMl > 0
                  ? <><b>{nf(recap.totalGrams)}</b> g<span className="stat-sub"><b>{nf(recap.totalMl)}</b> ml</span></>
                  : <><b>{nf(recap.totalGrams)}</b> g</>}</dd></div>
                <div><dt>{recap.activeDays === 1 ? 'Aktywny dzień' : 'Aktywne dni'}</dt><dd><b>{recap.activeDays}</b></dd></div>
                <div><dt>Wykupione</dt><dd><b>{nf(bought.grams)}</b> g{bought.ml > 0 && <span className="stat-sub"><b>{nf(bought.ml)}</b> ml</span>}{bought.cost > 0 && <span className="stat-sub">{nf(bought.cost, 0)} zł</span>}</dd></div>
                <div><dt>Średnia ocena</dt><dd><b>{recap.avgRating != null ? nf(recap.avgRating) : '–'}</b>{recap.ratedCount > 0 && <span className="stat-sub">z {recap.ratedCount} {recap.ratedCount === 1 ? 'oceny' : 'ocen'}</span>}</dd></div>
              </dl>
              {recap.topStrain && (
                <p className="recap-top">Najczęściej sięgałeś po <b className="dn">{recap.topStrain.name}</b>: {nf(recap.topStrain.grams)} {recap.topStrain.unit} w tym miesiącu.</p>
              )}
            </section>
          </>
        )}

        <h2 className="section-label">Zużycie tygodniowe, ostatnie {weekly.length} tygodni{hasMl && (chartUnit === 'ml' ? ' (olej i pen, ml)' : ' (susz, g)')}</h2>
        {weekly.every((w) => w.grams === 0 && !(w.ml > 0)) ? (
          <Empty icon="chart" title="Brak zużycia" text="Wpisuj zużycie w karcie odmiany, a tu pojawi się wykres tygodniowy." />
        ) : (
          <section className="card usage-chart">
            <svg viewBox="0 0 400 160" className="bars" role="img" aria-label={chartLabel}>
              <line className="axis" x1="6" x2="394" y1="130" y2="130" />
              {weekly.map((w, i) => {
                const h = (wk(w) / max) * 100, x = 12 + i * 47, y = 130 - h, r = Math.min(4, h);
                return (
                  <g key={w.label}>
                    {wk(w) > 0 && <path className="bar" d={`M${x} 130V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${34 - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V130z`} />}
                    <text className="val" x={x + 17} y={y - 6} textAnchor="middle">{wk(w) ? nf(wk(w)) : ''}</text>
                    <text className="tick" x={x + 17} y={148} textAnchor="middle">{w.label}</text>
                  </g>
                );
              })}
            </svg>
          </section>
        )}
        {mlWeeks.length > 0 && (
          <p className="muted small">Olej i pen (ml, osobno od suszu): {mlWeeks.map((w) => `tydzień od ${w.label}: ${nf(w.ml)} ml`).join(', ')}.</p>
        )}

        {top.length > 0 && (
          <>
            <h2 className="section-label">Najczęściej używane, 30 dni</h2>
            <ol className="list">
              {top.map((t) => (
                <li key={t.name} className="list-row"><span className="lr-main dn">{t.name}</span><span className="lr-value">{nf(t.grams, 2)} {t.unit}</span></li>
              ))}
            </ol>
          </>
        )}

        <h2 className="section-label">Zakupy</h2>
        {purchases.length === 0 ? (
          <Empty icon="list" title="Brak zakupów" text="Dodaj je w karcie odmiany, w polu „Wykupiłem”." />
        ) : (
          <Entries kind="purchase" rows={purchases} />
        )}

        <h2 className="section-label">Zużycie</h2>
        {usage.length === 0 ? (
          <Empty icon="clipboard" title="Brak wpisów" text="Dodaj je w karcie odmiany, w polu „Zużycie”." />
        ) : (
          <Entries kind="usage" rows={usage} />
        )}
      </main>
    </>
  );
}
