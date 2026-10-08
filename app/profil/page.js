import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import Header from '../components/Header';
import ProfileForm from './ProfileForm';
import PushSettings from './PushSettings';
import DiscreetSettings from './DiscreetSettings';
import NativeLock from './NativeLock';
import WebLockSettings from './WebLockSettings';
import NativeVersion from './NativeVersion';
import { ThemeChoice, BigChoice } from '../components/ThemeToggle';

export const dynamic = 'force-dynamic';

export default async function Profil() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [p] = await sql()`SELECT display_name, bio, links, profile_visibility, (avatar IS NOT NULL) AS has_avatar FROM users WHERE id = ${user.id}`;
  return (
    <>
      <Header user={user} />
      <main className="page settings">
        <h1>Mój profil</h1>
        <div className="stack">
          <ProfileForm me={{ id: user.id, username: user.username, isAdmin: user.is_admin }} initial={p}>
            <h2 className="section-label">Aplikacja na tym urządzeniu</h2>
            <NativeLock />
            <WebLockSettings />
            <PushSettings />
            <DiscreetSettings />
            <section className="card" aria-labelledby="theme-h">
              <h2 id="theme-h">Wygląd</h2>
              <ThemeChoice />
              <BigChoice />
            </section>
          </ProfileForm>
          <NativeVersion />
        </div>
      </main>
    </>
  );
}
