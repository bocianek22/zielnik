import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { listStrains, listOptions, dailyUse, purchaseStats } from '@/lib/strains';
import { dailyUsageSeries, homeSummary, prescriptionCountdown, todaySymptoms } from '@/lib/stats';
import { noUseToday } from '@/lib/no-use';
import Header from './components/Header';
import StrainsBoard from './components/StrainsBoard';
import HomeStore from './components/HomeStore';
import TodayBoard from './components/TodayBoard';
import Skeleton from './components/Skeleton';

export const dynamic = 'force-dynamic';

// Lista odmian (najcięższe zapytanie) jest strumieniowana osobno, żeby panel „Dziś” nie czekał na wpisy wszystkich odmian.
// Zapytanie startuje razem z zapytaniami panelu (obietnica przekazana z Home), a nie dopiero po ich zakończeniu.
async function StrainsData({ me, data }) {
  const [strains, options] = await data;
  return <StrainsBoard initialStrains={strains} initialOptions={options} me={me} />;
}

export default async function Home() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const listData = Promise.all([listStrains(user.id), listOptions()]);
  listData.catch(() => {}); // błąd zobaczy StrainsData; tu tylko bez nieobsłużonego odrzucenia, gdy panel padnie pierwszy
  const [daily, bought, series, summary, prescriptions, symptoms, noUse] = await Promise.all([
    dailyUse(user.id), purchaseStats(user.id), dailyUsageSeries(user.id, 14), homeSummary(user.id), prescriptionCountdown(user.id), todaySymptoms(user.id),
    noUseToday(user.id),
  ]);
  // data w nagłówku w czasie polskim (serwer działa w UTC)
  const date = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });
  const me = { id: user.id, username: user.username, isAdmin: user.is_admin, hidePrices: isNativeApp(await headers()) };

  return (
    <>
      <Header user={user} />
      <main className="page home">
        <header className="home-head">
          <p className="home-date">{date}</p>
          <h1>Dziś</h1>
        </header>
        <HomeStore bought={bought} series={series} summary={summary}>
          <TodayBoard usage={daily} bought={bought} prescriptions={prescriptions} symptoms={symptoms} noUse={noUse} />
          <h2 className="home-section">Odmiany</h2>
          <Suspense fallback={<Skeleton rows={6} />}>
            <StrainsData me={me} data={listData} />
          </Suspense>
        </HomeStore>
      </main>
    </>
  );
}
