import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import Header from '../components/Header';
import ProfileForm from './ProfileForm';

export const dynamic = 'force-dynamic';

export default async function Profil() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [p] = await sql()`SELECT display_name, bio, links, profile_visibility, (avatar IS NOT NULL) AS has_avatar FROM users WHERE id = ${user.id}`;
  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Mój profil</h1>
        <ProfileForm me={{ id: user.id, username: user.username, isAdmin: user.is_admin }} initial={p} />
      </main>
    </>
  );
}
