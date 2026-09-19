import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { listStrains, listOptions } from '@/lib/strains';
import Header from './components/Header';
import StrainsBoard from './components/StrainsBoard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const [strains, options] = await Promise.all([listStrains(), listOptions()]);

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Odmiany</h1>
        <StrainsBoard
          initialStrains={strains}
          initialOptions={options}
          me={{ id: user.id, username: user.username, isAdmin: user.is_admin }}
        />
      </main>
    </>
  );
}
