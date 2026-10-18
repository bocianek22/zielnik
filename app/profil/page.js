import SecHead from '../components/SecHead';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import Header from '../components/Header';
import ProfileForm from './ProfileForm';
import PushSettings from './PushSettings';
import ReminderSettings from './ReminderSettings';
import LocalReminderSettings from './LocalReminderSettings';
import ScreenSecureSettings from './ScreenSecureSettings';
import DiscreetSettings from './DiscreetSettings';
import NativeLock from './NativeLock';
import WebLockSettings from './WebLockSettings';
import NativeVersion from './NativeVersion';
import Link from 'next/link';
import { VERSION } from '@/lib/version';
import Icon from '../components/Icon';
import HashOpen from '../components/HashOpen';
import SettingsGroup from './SettingsGroup';
import TodaySettings from './TodaySettings';
import { todayLayout } from '@/lib/today-layout';
import { ThemeChoice, BigChoice } from '../components/ThemeToggle';
import PageHero from '../components/PageHero';

export const dynamic = 'force-dynamic';

export default async function Profil() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const [[p], { hidden, order }] = await Promise.all([
    sql()`SELECT display_name, bio, links, profile_visibility, (avatar IS NOT NULL) AS has_avatar FROM users WHERE id = ${user.id}`,
    todayLayout(user.id),
  ]);
  return (
    <>
      <Header user={user} />
      <main className="page settings">
        <PageHero icon="user" title="Mój profil" sub="Konto, prywatność i ustawienia" />
        <HashOpen />
        <nav className="chips settings-jump" aria-label="Przejdź do ustawień">
          {[['#bezpieczenstwo', 'Prywatność'], ['#przypomnienia', 'Przypomnienia'], ['#wyglad', 'Wygląd'], ['#ekran-dzis', 'Ekran „Dziś”'], ['#moje-dane', 'Moje dane']]
            .map(([href, label]) => <a key={href} className="chip" href={href}>{label}</a>)}
        </nav>
        <div className="stack">
          <ProfileForm me={{ id: user.id, username: user.username, isAdmin: user.is_admin }} initial={p}>
            {/* UI 4: ustawienia urządzenia w trzech zwijanych grupach (skróty u góry i linki z kotwicą otwierają grupę) */}
            <h2 className="section-label">Aplikacja na tym urządzeniu</h2>
            <SettingsGroup icon="shield" title="Prywatność" value="Blokada, dyskrecja" id="bezpieczenstwo">
              <NativeLock />
              <ScreenSecureSettings />
              <WebLockSettings />
              <DiscreetSettings />
            </SettingsGroup>
            <SettingsGroup icon="bell" title="Przypomnienia" value="Objawy, wizyta" id="przypomnienia">
              <PushSettings />
              <ReminderSettings />
              <LocalReminderSettings />
            </SettingsGroup>
            <SettingsGroup icon="sun" title="Wygląd" value="Motyw, tekst" id="wyglad">
              <section aria-labelledby="theme-h" className="stack">
                <h3 id="theme-h" className="sr-only">Wygląd</h3>
                <ThemeChoice />
                <BigChoice />
              </section>
            </SettingsGroup>
            {/* UI 5: wszystkie ustawienia w profilu, na ekranie „Dziś” tylko link „Dostosuj ekran” */}
            <SettingsGroup icon="home" title="Ekran „Dziś”" value="Układ, progi" id="ekran-dzis">
              <TodaySettings initial={{ hidden, order }} />
            </SettingsGroup>
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
