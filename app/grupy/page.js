import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import GroupsBoard from './GroupsBoard';
import PageHero from '../components/PageHero';

export const dynamic = 'force-dynamic';

export default async function Grupy() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <PageHero cat="social" icon="group" title="Grupy" sub="Wspólne oceny i ranking ze znajomymi" />
        <GroupsBoard />
      </main>
    </>
  );
}
