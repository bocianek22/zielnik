import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import FriendsBoard from './FriendsBoard';
import PageHero from '../components/PageHero';

export const dynamic = 'force-dynamic';

export default async function Znajomi() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <PageHero cat="social" icon="users" title="Znajomi" sub="Osoby, z którymi dzielisz oceny" />
        <FriendsBoard />
      </main>
    </>
  );
}
