import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { rankingRows } from '@/lib/strains';
import Header from '../components/Header';
import Rankings from './Rankings';

export const dynamic = 'force-dynamic';

export default async function RankingsPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  // do rankingów wystarczą oceny: odmiana + (użytkownik, ocena, data oceny)
  // (bez notatek, opisów i zdjęć; jedna strona do PAGE_MAX najnowszych odmian)
  const { strains, next } = await rankingRows(user.id);

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Rankingi</h1>
        <Rankings strains={strains} meId={user.id} />
        {next && <p className="muted">Ranking obejmuje najnowsze odmiany ({strains.length}).</p>}
      </main>
    </>
  );
}
