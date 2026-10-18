import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { wheelItems } from '@/lib/strains';
import Header from '../components/Header';
import Wheel from './Wheel';
import PageHero from '../components/PageHero';

export const dynamic = 'force-dynamic';

export default async function WheelPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  // Na kole tylko odmiany, których Twój aktualny stan jest większy od 0
  const items = await wheelItems(user.id);

  return (
    <>
      <Header user={user} />
      <main className="page">
        <PageHero cat="strain" icon="shuffle" title="Koło fortuny" sub="Losowa odmiana z Twojej listy" />
        <Wheel items={items} />
      </main>
    </>
  );
}
