import { Suspense } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { listStrains, listOptions, dailyUse } from '@/lib/strains';
import Header from '../components/Header';
import StrainsBoard from '../components/StrainsBoard';
import HomeStore from '../components/HomeStore';
import Skeleton from '../components/Skeleton';
import Icon from '../components/Icon';
import WidgetSync from './WidgetSync';

export const dynamic = 'force-dynamic';

// Lista jest strumieniowana: nagłówek i przełącznik widoków pokazują się od razu, karty po wczytaniu wpisów.
async function StrainsData({ me, data }) {
  const [strains, options] = await data;
  return <StrainsBoard initialStrains={strains} initialOptions={options} me={me} />;
}

// Lista odmian (do 0.53 pod panelem „Dziś” na stronie głównej). HomeStore bez danych panelu: lista bierze z niego
// próg „Kończy się” i obsługę zapisów; sum panelu ta strona nie pokazuje.
export default async function Strains() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const listData = Promise.all([listStrains(user.id), listOptions()]);
  listData.catch(() => {}); // błąd zobaczy StrainsData
  const [h, usage] = await Promise.all([headers(), dailyUse(user.id)]);
  const me = { id: user.id, username: user.username, isAdmin: user.is_admin, hidePrices: isNativeApp(h) };
  // dzień w czasie polskim (serwer działa w UTC), jak w serii panelu „Dziś”
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  return (
    <>
      <Header user={user} />
      <main className="page strains-page">
        <header className="page-head">
          <h1 id="odmiany" tabIndex={-1}>Odmiany</h1>
          <Link href="/szukaj" className="icon-btn" aria-label="Szukaj wszędzie: odmiany, osoby, wiedza"><Icon name="search" /></Link>
        </header>
        <nav className="seg seg-links" aria-label="Widok odmian">
          <Link href="/odmiany" className="on" aria-current="page">Moje</Link>
          <Link href="/katalog">Katalog</Link>
          <Link href="/rankings">Rankingi</Link>
        </nav>
        <HomeStore>
          <WidgetSync dailyUse={{ g: usage.perDay || 0, ml: usage.perDayMl || 0 }} today={today} />
          <Suspense fallback={<Skeleton rows={6} />}>
            <StrainsData me={me} data={listData} />
          </Suspense>
        </HomeStore>
      </main>
    </>
  );
}
