import SecHead from '../components/SecHead';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import Header from '../components/Header';
import ProfileForm from './ProfileForm';
import PushSettings from './PushSettings';
import ReminderSettings from './ReminderSettings';
import DiscreetSettings from './DiscreetSettings';
import NativeLock from './NativeLock';
import WebLockSettings from './WebLockSettings';
import NativeVersion from './NativeVersion';
import Link from 'next/link';
import { VERSION } from '@/lib/version';
import Icon from '../components/Icon';
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
            <ReminderSettings />
            <DiscreetSettings />
            <section className="card" aria-labelledby="theme-h">
              <SecHead icon="sun" id="theme-h">Wygląd</SecHead>
              <ThemeChoice />
              <BigChoice />
            </section>
          </ProfileForm>
          <section className="card" aria-labelledby="about-h">
            <SecHead icon="info" id="about-h">O aplikacji</SecHead>
            <p>
              <span className="brand-name">Zielnik</span><span className="brand-alt">Notatnik</span> v{VERSION} <span className="badge">Beta</span>
            </p>
            <p className="muted">Wersja testowa: coś może jeszcze nie działać jak trzeba. Dziękujemy za uwagi.</p>
            <div className="list inset">
              <Link className="list-row" href="/pomoc#co-nowego"><Icon name="info" /><span className="lr-main">Co nowego</span></Link>
              <Link className="list-row" href="/pomoc"><Icon name="book" /><span className="lr-main">Pomoc i instalacja</span></Link>
              <Link className="list-row" href="/uwagi?ekran=%2Fprofil"><Icon name="edit" /><span className="lr-main">Zgłoś uwagę</span></Link>
            </div>
          </section>
          <NativeVersion />
        </div>
      </main>
    </>
  );
}
