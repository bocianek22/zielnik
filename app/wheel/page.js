import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { listStrains } from '@/lib/strains';
import Header from '../components/Header';
import Wheel from './Wheel';

export const dynamic = 'force-dynamic';

export default async function WheelPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  // Na kole tylko odmiany, których Twój aktualny stan jest większy od 0
  const items = (await listStrains())
    .map((s) => ({ s, mine: s.entries.find((e) => e.userId === user.id) }))
    .filter(({ mine }) => mine && mine.current > 0)
    .map(({ s, mine }) => ({ id: s.id, name: s.name, producer: s.producer, type: s.type, current: mine.current }));

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Koło fortuny</h1>
        <Wheel items={items} />
      </main>
    </>
  );
}
