import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { history, monthlyRecap, purchaseStats, prescriptionOptions } from '@/lib/strains';
import Header from '../components/Header';
import Icon from '../components/Icon';
import Entries from './Entries';
import WeeklyBars from '../components/charts/WeeklyBars';
import PeriodCompare from '../components/charts/PeriodCompare';

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
  const [{ purchases, usage, weekly, top }, recap, bought, rxOptions] = await Promise.all([
    history(user.id), monthlyRecap(user.id), purchaseStats(user.id), prescriptionOptions(user.id),
  ]);
  const monthLabel = cap(new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }));
  const hasRecap = recap.totalGrams > 0 || recap.totalMl > 0 || recap.ratedCount > 0 || bought.grams > 0 || bought.ml > 0;
  const nothing = !hasRecap && purchases.length === 0 && usage.length === 0 && weekly.every((w) => w.grams === 0 && !(w.ml > 0));

  return (
    <>
      <Header user={user} />
      <main className="page hist-page">
        <h1>Historia</h1>
        {nothing ? (
          <Empty icon="clipboard" title="Historia jest jeszcze pusta" text="Tu pojawią się zakupy, zużycie i wykres tygodniowy. Zacznij od zapisania pierwszego zużycia w karcie odmiany." />
        ) : (<>
        {hasRecap && (
          <>
            <h2 className="section-label">Twój miesiąc: {monthLabel}</h2>
            <section className="card recap summary">
              <dl className="stat-strip">
                <div><dt>Zużyte</dt><dd><b>{nf(recap.totalGrams)}</b> g{recap.totalMl > 0 && <span className="stat-sub"><b>{nf(recap.totalMl)}</b> ml</span>}</dd></div>
                <div><dt>{recap.activeDays === 1 ? 'Aktywny dzień' : 'Aktywne dni'}</dt><dd><b>{recap.activeDays}</b></dd></div>
                <div><dt>Wykupione</dt><dd><b>{nf(bought.grams)}</b> g{bought.ml > 0 && <span className="stat-sub"><b>{nf(bought.ml)}</b> ml</span>}{bought.cost > 0 && <span className="stat-sub">{nf(bought.cost, 0)} zł</span>}</dd></div>
              </dl>
              {recap.avgRating != null && (
                <p className="recap-top">Średnia ocena: <b>{nf(recap.avgRating)}</b> (z {recap.ratedCount} {recap.ratedCount === 1 ? 'oceny' : 'ocen'})</p>
              )}
              {recap.topStrain && (
                <p className="recap-top">Najczęściej: <b className="dn">{recap.topStrain.name}</b>, {nf(recap.topStrain.grams)} {recap.topStrain.unit}</p>
              )}
            </section>
          </>
        )}
        <PeriodCompare recap={recap} />

        <WeeklyBars weekly={weekly} empty={<Empty icon="chart" title="Brak zużycia" text="Wpisuj zużycie w karcie odmiany, a tu pojawi się wykres tygodniowy." />} />

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
          <Entries kind="purchase" rows={purchases} prescriptions={rxOptions} />
        )}

        <h2 className="section-label">Zużycie</h2>
        {usage.length === 0 ? (
          <Empty icon="clipboard" title="Brak wpisów" text="Dodaj je w karcie odmiany, w polu „Zużycie”." />
        ) : (
          <Entries kind="usage" rows={usage} />
        )}
        </>)}
      </main>
    </>
  );
}
