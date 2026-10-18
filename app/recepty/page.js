import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
import Icon from '../components/Icon';
import Header from '../components/Header';
import Prescriptions from './Prescriptions';
import PharmacyCard from './PharmacyCard';
import { homeSummary, pharmacyPools, prescriptionCountdown } from '@/lib/stats';
import { dailyUse } from '@/lib/strains';
import { todayPL } from '@/lib/date';
import RefillCard from './RefillCard';

export const dynamic = 'force-dynamic';

export default async function Recepty() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [rx, pools, summary, usage] = await Promise.all([prescriptionCountdown(user.id), pharmacyPools(user.id), homeSummary(user.id, 1), dailyUse(user.id)]);
  return (
    <>
      <Header user={user} />
      <main className="page">
        <header className="hero cat-hero" data-cat="rx">
          <div className="hero-top">
            <span className="ic-dot sq"><Icon name="file" size={24} /></span>
            <div>
              <h1>Recepty</h1>
              <p className="hero-sub">Ile zostało i do kiedy ważne</p>
            </div>
          </div>
        </header>
        <p className="muted rx-note">To notatnik dla Ciebie, nie dokument medyczny. <Link href="/pomoc#faq">Więcej</Link> · <Link href="/recepty/karta">Karta terapii na wyjazd</Link></p>
        <div className="stack">
          <RefillCard stock={summary.stock} perDay={{ g: usage.perDay, ml: usage.perDayMl }} rx={rx.items} today={todayPL()} />
          <PharmacyCard rx={rx.items} pools={pools} />
          <Prescriptions />
        </div>
      </main>
    </>
  );
}
