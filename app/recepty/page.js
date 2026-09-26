import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import Prescriptions from './Prescriptions';

export const dynamic = 'force-dynamic';

export default async function Recepty() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Recepty</h1>
        <Prescriptions />
      </main>
    </>
  );
}
