import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import GroupsBoard from './GroupsBoard';

export const dynamic = 'force-dynamic';

export default async function Grupy() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Grupy</h1>
        <GroupsBoard />
      </main>
    </>
  );
}
