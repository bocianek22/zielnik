import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { history, monthlyRecap, purchaseStats, prescriptionOptions } from '@/lib/strains';
import { periodCompare } from '@/lib/recap';
import SecHead from '../components/SecHead';
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
      <Link className="btn ghost" href="/odmiany">Przejdź do odmian</Link>
    </div>
  );
}

export default async function Historia() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [{ purchases, usage, weekly, top }, recap, bought, rxOptions, compare] = await Promise.all([
    history(user.id), monthlyRecap(user.id), purchaseStats(user.id), prescriptionOptions(user.id), periodCompare(user.id),
  ]);
  const monthLabel = cap(new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }));
  const hasRecap = recap.totalGrams > 0 || recap.totalMl > 0 || recap.ratedCount > 0 || bought.grams > 0 || bought.ml > 0;
  const nothing = !hasRecap && purchases.length === 0 && usage.length === 0 && weekly.every((w) => w.grams === 0 && !(w.ml > 0));

  return (
    <>
      <Header user={user} />
      <main className="page hist-page">
        <header className="hero cat-hero" data-cat="stock">
          <div className="hero-top">
            <span className="ic-dot sq"><Icon name="list" size={24} /></span>
            <div>
              <h1>Historia</h1>
              <p className="hero-sub">Zakupy, zużycie i podsumowania</p>
            </div>
          </div>
        </header>
        {nothing ? (
          <Empty icon="clipboard" title="Historia jest jeszcze pusta" text="Tu pojawią się zakupy, zużycie i wykres tygodniowy. Zacznij od zapisania pierwszego zużycia w karcie odmiany." />
        ) : (<>
        {hasRecap && (
          <>
            <SecHead cat="stock" icon="calendar">Twój miesiąc: {monthLabel}</SecHead>
            <section className="hist-kpis" data-cat="stock" aria-label={`Podsumowanie: ${monthLabel}`}>
              <div className="kpi-tile"><span className="kt-label">Zużyte</span><span className="kt-value">{nf(recap.totalGrams)}<small>g</small></span>{recap.totalMl > 0 && <span className="kt-sub">{nf(recap.totalMl)} ml</span>}</div>
              <div className="kpi-tile"><span className="kt-label">{recap.activeDays === 1 ? 'Aktywny dzień' : 'Aktywne dni'}</span><span className="kt-value">{recap.activeDays}</span></div>
              <div className="kpi-tile"><span className="kt-label">Wykupione</span><span className="kt-value">{nf(bought.grams)}<small>g</small></span>{(bought.ml > 0 || bought.cost > 0) && <span className="kt-sub">{[bought.ml > 0 && `${nf(bought.ml)} ml`, bought.cost > 0 && `${nf(bought.cost, 0)} zł`].filter(Boolean).join(' · ')}</span>}</div>
            </section>
            {(recap.avgRating != null || recap.topStrain) && (
              <section className="card recap">
                {recap.avgRating != null && (
                  <p className="recap-top">Średnia ocena: <b>{nf(recap.avgRating)}</b> (z {recap.ratedCount} {recap.ratedCount === 1 ? 'oceny' : 'ocen'})</p>
                )}
                {recap.topStrain && (
                  <p className="recap-top">Najczęściej: <b className="dn">{recap.topStrain.name}</b>, {nf(recap.topStrain.grams)} {recap.topStrain.unit}</p>
                )}
              </section>
            )}
          </>
        )}
        <PeriodCompare compare={compare} />

        <WeeklyBars weekly={weekly} empty={<Empty icon="chart" title="Brak zużycia" text="Wpisuj zużycie w karcie odmiany, a tu pojawi się wykres tygodniowy." />} />

        {top.length > 0 && (
          <>
            <SecHead cat="stock" icon="trend">Najczęściej używane, 30 dni</SecHead>
            <ol className="list">
              {top.map((t) => (
                <li key={t.name} className="list-row"><span className="lr-main dn">{t.name}</span><span className="lr-value">{nf(t.grams, 2)} {t.unit}</span></li>
              ))}
            </ol>
          </>
        )}

        <SecHead cat="stock" icon="cart">Zakupy</SecHead>
        {purchases.length === 0 ? (
          <Empty icon="list" title="Brak zakupów" text="Dodaj je w karcie odmiany, w polu „Wykupiłem”." />
        ) : (
          <Entries kind="purchase" rows={purchases} prescriptions={rxOptions} />
        )}

        <SecHead cat="stock" icon="jar">Zużycie</SecHead>
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
