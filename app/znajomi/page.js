import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import FriendsBoard from './FriendsBoard';

export const dynamic = 'force-dynamic';

export default async function Znajomi() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Znajomi</h1>
        <FriendsBoard />
      </main>
    </>
  );
}
