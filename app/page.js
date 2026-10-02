import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { listStrains, listOptions, dailyUse, purchaseStats, prescriptionAlerts } from '@/lib/strains';
import Header from './components/Header';
import StrainsBoard from './components/StrainsBoard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const [strains, options, daily, bought, alerts] = await Promise.all([
    listStrains(user.id), listOptions(), dailyUse(user.id), purchaseStats(user.id), prescriptionAlerts(user.id),
  ]);

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Odmiany</h1>
        {alerts.length > 0 && (
          <div className="alert note">
            {alerts.map((a, i) => (
              <p key={i} style={{ margin: i ? '6px 0 0' : 0 }}>
                {a.days_left < 0
                  ? <>Recepta na <b>{a.grams} g</b> wygasła {-a.days_left} {-a.days_left === 1 ? 'dzień' : 'dni'} temu, a zostało niewykorzystane <b>{a.remaining} g</b>.</>
                  : <>Recepta na <b>{a.grams} g</b> wygasa za <b>{a.days_left} {a.days_left === 1 ? 'dzień' : 'dni'}</b>, zostało do wykupienia <b>{a.remaining} g</b>.</>}
                {' '}<Link href="/recepty">Zobacz recepty</Link>
              </p>
            ))}
          </div>
        )}
        <StrainsBoard
          initialStrains={strains}
          initialOptions={options}
          usage={daily}
          bought={bought}
          me={{ id: user.id, username: user.username, isAdmin: user.is_admin, hidePrices: isNativeApp(await headers()) }}
        />
      </main>
    </>
  );
}
