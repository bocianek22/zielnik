import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import UsersAdmin from './UsersAdmin';
import InvitesAdmin from './InvitesAdmin';
import ReportsAdmin from './ReportsAdmin';
import BackupsAdmin from './BackupsAdmin';
import PlansAdmin from './PlansAdmin';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  if (!user.is_admin) redirect('/');
  return (
    <>
      <Header user={user} />
      <main className="page stack">
        <h1>Użytkownicy</h1>
        <UsersAdmin meId={user.id} />
        <InvitesAdmin />
        <ReportsAdmin />
        <PlansAdmin />
        <BackupsAdmin />
      </main>
    </>
  );
}
