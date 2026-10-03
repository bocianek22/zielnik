import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { listStrains, listOptions, dailyUse, purchaseStats } from '@/lib/strains';
import { dailyUsageSeries, recentStrainIds, prescriptionCountdown, todaySymptoms } from '@/lib/stats';
import Header from './components/Header';
import StrainsBoard from './components/StrainsBoard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const [strains, options, daily, bought, series, recent, prescriptions, symptoms] = await Promise.all([
    listStrains(user.id), listOptions(), dailyUse(user.id), purchaseStats(user.id),
    dailyUsageSeries(user.id, 14), recentStrainIds(user.id), prescriptionCountdown(user.id), todaySymptoms(user.id),
  ]);
  // data w nagłówku w czasie polskim (serwer działa w UTC)
  const date = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Warsaw' });

  return (
    <>
      <Header user={user} />
      <main className="page home">
        <header className="home-head">
          <p className="home-date">{date}</p>
          <h1>Dziś</h1>
        </header>
        <StrainsBoard
          initialStrains={strains}
          initialOptions={options}
          usage={daily}
          bought={bought}
          series={series}
          recent={recent}
          prescriptions={prescriptions}
          symptoms={symptoms}
          me={{ id: user.id, username: user.username, isAdmin: user.is_admin, hidePrices: isNativeApp(await headers()) }}
        />
      </main>
    </>
  );
}
