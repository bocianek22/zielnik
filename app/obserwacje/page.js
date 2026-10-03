import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { observations, normPeriod, PERIODS } from '@/lib/observations';
import { fmtQty } from '@/lib/units';
import Header from '../components/Header';
import Icon from '../components/Icon';
import ObservationsBoard from './ObservationsBoard';

export const dynamic = 'force-dynamic';

const periodLabel = (d) => (d === 365 ? 'Rok' : `${d} dni`);
const dayWord = (n) => (n === 1 ? 'dzień' : 'dni');
// 1 wpis, 2–4 wpisy (poza 12–14), 5+ wpisów
const plural = (n, one, few, many) => (n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many);

function Empty({ title, text }) {
  return (
    <div className="card empty">
      <Icon name="pulse" size={32} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="btn ghost" href="/dziennik">Otwórz dziennik objawów</Link>
    </div>
  );
}

// POM-06: opisowe średnie z własnych wpisów (lib/observations.js); bez porad, bez trendu dawka-objaw, tylko właściciel
export default async function Obserwacje({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const sp = (await searchParams) || {};
  const period = normPeriod(sp.okres);
  const data = await observations(user.id, period);
  const anyGroup = Object.values(data.symptoms).some((s) => s.days > 0);

  return (
    <>
      <Header user={user} />
      <main className="page obs-page">
        <h1>Moje obserwacje</h1>
        <p className="obs-lead">Średnie z Twojego dziennika objawów w dniach, w których używałeś danej odmiany.</p>
        <div className="alert note">To zestawienie Twoich zapisów, nie ocena skuteczności. Zmiany leczenia omawiaj z lekarzem.</div>

        <nav className="seg obs-period" aria-label="Okres">
          {PERIODS.map((d) => (
            <Link key={d} href={d === 90 ? '/obserwacje' : `/obserwacje?okres=${d}`} className={d === period ? 'on' : ''}
              aria-current={d === period ? 'page' : undefined} replace scroll={false}>{periodLabel(d)}</Link>
          ))}
        </nav>

        {data.entries === 0 ? (
          <Empty title="Brak wpisów objawów" text={`W tym okresie nie ma wpisów w dzienniku objawów. Obserwacje pojawią się, gdy w grupie będzie co najmniej ${data.minDays} dni.`} />
        ) : !data.firstUse ? (
          <Empty title="Brak wpisów zużycia" text="Obserwacje łączą dziennik objawów z zużyciem. Wpisuj zużycie w karcie odmiany albo w panelu „Dziś”." />
        ) : (
          <>
            <p className="obs-summary">
              <b>{data.entries}</b> {plural(data.entries, 'wpis', 'wpisy', 'wpisów')} objawów · <b>{data.strains.length}</b> {plural(data.strains.length, 'odmiana', 'odmiany', 'odmian')}
              {data.mixed.days > 0 && <> · <b>{data.mixed.days}</b> {dayWord(data.mixed.days)} z kilkoma odmianami</>}
            </p>

            {anyGroup ? <ObservationsBoard symptoms={data.symptoms} minDays={data.minDays} /> : (
              <p className="muted small">Wpisy objawów z tego okresu są sprzed pierwszego zapisu zużycia, więc nie ma ich z czym zestawić.</p>
            )}

            {data.strains.length > 0 && (
              <>
                <h2 className="section-label">Zużycie w okresie</h2>
                <ul className="list">
                  {data.strains.map((s) => (
                    <li key={s.id} className="list-row">
                      <span className="lr-main"><span className="dn">{s.name}</span><span className="lr-sub">{s.useDays} {dayWord(s.useDays)} z użyciem</span></span>
                      <span className="lr-value">{fmtQty(s.total, s.unit)}</span>
                    </li>
                  ))}
                  {data.mixed.days > 0 && (
                    <li className="list-row">
                      <span className="lr-main">Dni z kilkoma odmianami<span className="lr-sub">{data.mixed.days} {dayWord(data.mixed.days)}, ilości wliczone też wyżej</span></span>
                      <span className="lr-value">{[data.mixed.g > 0 && fmtQty(data.mixed.g, 'g'), data.mixed.ml > 0 && fmtQty(data.mixed.ml, 'ml')].filter(Boolean).join(' · ')}</span>
                    </li>
                  )}
                </ul>
                <p className="muted small">Susz w gramach, olej i pen w mililitrach. Jednostek nie sumujemy.</p>
              </>
            )}
          </>
        )}

        <h2 className="section-label">Jak liczymy</h2>
        <section className="card obs-rules">
          <ul>
            <li>Dzień z jedną odmianą trafia do jej wiersza. Dni z kilkoma odmianami i dni bez zużycia mają osobne wiersze.</li>
            <li>Jakość snu dotyczy ostatniej nocy, więc porównujemy ją z zużyciem z poprzedniego dnia. Pozostałe objawy z tym samym dniem.</li>
            <li>Średnią pokazujemy od {data.minDays} dni w grupie. Przy mniejszej liczbie widać tylko liczbę dni.</li>
            <li>Dni bez zużycia liczymy od pierwszego zapisu zużycia. Dni liczymy w czasie polskim.</li>
            <li>Zestawienie widzisz tylko Ty. Nie trafia do profilu, grup ani do znajomych.</li>
          </ul>
        </section>
      </main>
    </>
  );
}
