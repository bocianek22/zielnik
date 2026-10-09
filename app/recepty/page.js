import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Link from 'next/link';
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
        <h1>Recepty</h1>
        <p className="muted rx-note">Notatnik recept służy tylko Twojej orientacji, to nie dokument ani rejestr medyczny. <Link href="/pomoc#faq">Więcej</Link></p>
        <div className="stack">
          <PharmacyCard rx={rx.items} pools={pools} />
          <Prescriptions />
        </div>
      </main>
    </>
  );
}
