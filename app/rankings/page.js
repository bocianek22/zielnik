import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { listStrains } from '@/lib/strains';
import Header from '../components/Header';
import Rankings from './Rankings';

export const dynamic = 'force-dynamic';

export default async function RankingsPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  // do rankingów wystarczą oceny: odmiana + (użytkownik, ocena, data oceny)
  const strains = (await listStrains()).map((s) => ({
    id: s.id, name: s.name, producer: s.producer, type: s.type,
    ratings: s.entries.filter((e) => e.rating != null).map((e) => ({ userId: e.userId, rating: e.rating, at: e.ratedAt })),
  }));

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Rankingi</h1>
        <Rankings strains={strains} meId={user.id} />
      </main>
    </>
  );
}
