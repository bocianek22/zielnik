import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { history, monthlyRecap, purchaseStats } from '@/lib/strains';
import Header from '../components/Header';
import Icon from '../components/Icon';

export const dynamic = 'force-dynamic';

const nf = (n, max = 1) => Number(n).toLocaleString('pl-PL', { maximumFractionDigits: max });
const day = (at) => new Date(`${String(at).slice(0, 10)}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
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
  const max = Math.max(1, ...weekly.map((w) => w.grams));
  const monthLabel = cap(new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }));
  const hasRecap = recap.totalGrams > 0 || recap.ratedCount > 0 || bought.grams > 0;
  const weeklyTotal = weekly.reduce((a, w) => a + w.grams, 0);
  const peak = weekly.reduce((a, w) => (w.grams > a.grams ? w : a), weekly[0] || { grams: 0, label: '' });
  const chartLabel = `Zużycie tygodniowe w gramach, ostatnie ${weekly.length} tygodni: razem ${nf(weeklyTotal)} g, najwięcej ${nf(peak.grams)} g w tygodniu od ${peak.label}.`;

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
                <div><dt>Zużyte</dt><dd><b>{nf(recap.totalGrams)}</b> g</dd></div>
                <div><dt>{recap.activeDays === 1 ? 'Aktywny dzień' : 'Aktywne dni'}</dt><dd><b>{recap.activeDays}</b></dd></div>
                <div><dt>Wykupione</dt><dd><b>{nf(bought.grams)}</b> g{bought.cost > 0 && <span className="stat-sub">{nf(bought.cost, 0)} zł</span>}</dd></div>
                <div><dt>Średnia ocena</dt><dd><b>{recap.avgRating != null ? nf(recap.avgRating) : '–'}</b>{recap.ratedCount > 0 && <span className="stat-sub">z {recap.ratedCount} {recap.ratedCount === 1 ? 'oceny' : 'ocen'}</span>}</dd></div>
              </dl>
              {recap.topStrain && (
                <p className="recap-top">Najczęściej sięgałeś po <b className="dn">{recap.topStrain.name}</b>: {nf(recap.topStrain.grams)} g w tym miesiącu.</p>
              )}
            </section>
          </>
        )}

        <h2 className="section-label">Zużycie tygodniowe, ostatnie {weekly.length} tygodni</h2>
        {weekly.every((w) => w.grams === 0) ? (
          <Empty icon="chart" title="Brak zużycia" text="Wpisuj zużycie w karcie odmiany, a tu pojawi się wykres tygodniowy." />
        ) : (
          <section className="card usage-chart">
            <svg viewBox="0 0 400 160" className="bars" role="img" aria-label={chartLabel}>
              <line className="axis" x1="6" x2="394" y1="130" y2="130" />
              {weekly.map((w, i) => {
                const h = (w.grams / max) * 100, x = 12 + i * 47, y = 130 - h, r = Math.min(4, h);
                return (
                  <g key={w.label}>
                    {w.grams > 0 && <path className="bar" d={`M${x} 130V${y + r}a${r} ${r} 0 0 1 ${r} ${-r}h${34 - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}V130z`} />}
                    <text className="val" x={x + 17} y={y - 6} textAnchor="middle">{w.grams ? nf(w.grams) : ''}</text>
                    <text className="tick" x={x + 17} y={148} textAnchor="middle">{w.label}</text>
                  </g>
                );
              })}
            </svg>
          </section>
        )}

        {top.length > 0 && (
          <>
            <h2 className="section-label">Najczęściej używane, 30 dni</h2>
            <ol className="list">
              {top.map((t) => (
                <li key={t.name} className="list-row"><span className="lr-main dn">{t.name}</span><span className="lr-value">{nf(t.grams, 2)} g</span></li>
              ))}
            </ol>
          </>
        )}

        <h2 className="section-label">Zakupy</h2>
        {purchases.length === 0 ? (
          <Empty icon="list" title="Brak zakupów" text="Dodaj je w karcie odmiany, w polu „Wykupiłem”." />
        ) : (
          <>
            <ul className="list hist-list">
              {purchases.map((p, i) => (
                <li key={i} className="list-row">
                  <span className="lr-main"><span className="dn">{p.name}</span><span className="lr-sub">{day(p.at)}</span></span>
                  <span className="lr-value">{nf(p.grams, 2)} g{p.cost != null && <small>{nf(p.cost, 2)} zł</small>}</span>
                </li>
              ))}
            </ul>
            <div className="card hist-table"><div className="table-wrap"><table className="cmp hist-cmp"><thead><tr><th>Data</th><th>Odmiana</th><th className="num">Ilość</th><th className="num">Koszt</th></tr></thead>
              <tbody>{purchases.map((p, i) => (
                <tr key={i}><td>{day(p.at)}</td><td><span className="dn">{p.name}</span></td><td className="num">{nf(p.grams, 2)} g</td><td className="num">{p.cost != null ? `${nf(p.cost, 2)} zł` : '–'}</td></tr>
              ))}</tbody></table></div></div>
          </>
        )}

        <h2 className="section-label">Zużycie</h2>
        {usage.length === 0 ? (
          <Empty icon="clipboard" title="Brak wpisów" text="Dodaj je w karcie odmiany, w polu „Zużycie”." />
        ) : (
          <>
            <ul className="list hist-list">
              {usage.map((u, i) => (
                <li key={i} className="list-row">
                  <span className="lr-main"><span className="dn">{u.name}</span><span className="lr-sub">{day(u.at)}</span></span>
                  <span className="lr-value">{nf(u.grams, 2)} g</span>
                </li>
              ))}
            </ul>
            <div className="card hist-table"><div className="table-wrap"><table className="cmp hist-cmp"><thead><tr><th>Data</th><th>Odmiana</th><th className="num">Ilość</th></tr></thead>
              <tbody>{usage.map((u, i) => (
                <tr key={i}><td>{day(u.at)}</td><td><span className="dn">{u.name}</span></td><td className="num">{nf(u.grams, 2)} g</td></tr>
              ))}</tbody></table></div></div>
          </>
        )}
      </main>
    </>
  );
}
