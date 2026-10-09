import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
import Icon from '../components/Icon';
import Header from '../components/Header';
import Prescriptions from './Prescriptions';
import PharmacyCard from './PharmacyCard';
import { pharmacyPools, prescriptionCountdown } from '@/lib/stats';

export const dynamic = 'force-dynamic';

export default async function Recepty() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [rx, pools] = await Promise.all([prescriptionCountdown(user.id), pharmacyPools(user.id)]);
  return (
    <>
      <Header user={user} />
      <main className="page">
        <header className="hero cat-hero" data-cat="rx">
          <div className="hero-top">
            <span className="ic-dot sq"><Icon name="clipboard" size={24} /></span>
            <div>
              <h1>Recepty</h1>
              <p className="hero-sub">Ile zostało i do kiedy ważne</p>
            </div>
          </div>
        </header>
        <p className="muted rx-note">Notatnik recept służy tylko Twojej orientacji, to nie dokument ani rejestr medyczny. <Link href="/pomoc#faq">Więcej</Link></p>
        <div className="stack">
          <PharmacyCard rx={rx.items} pools={pools} />
          <Prescriptions />
        </div>
      </main>
    </>
  );
}
