import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import ChangePasswordForm from './ChangePasswordForm';

export const dynamic = 'force-dynamic';

export default async function ChangePasswordPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <ChangePasswordForm forced={user.must_change_password} />
      </main>
    </>
  );
}
