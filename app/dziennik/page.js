import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import { symptomStreak } from '@/lib/streak';
import { todayPL } from '@/lib/date';
import SymptomStreak from '../components/SymptomStreak';
import Header from '../components/Header';
import Icon from '../components/Icon';
import SymptomsBoard from './SymptomsBoard';

export const dynamic = 'force-dynamic';

export default async function Dziennik({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const streak = await symptomStreak(user.id);
  // ?dzien=RRRR-MM-DD (karta dnia w Historii): wpis z tego dnia; niepoprawna lub przyszła data = dziś
  const raw = String((await searchParams)?.dzien || '');
  const initialDay = /^\d{4}-\d{2}-\d{2}$/.test(raw) && !Number.isNaN(Date.parse(raw)) && raw <= todayPL() ? raw : null;
  return (
    <>
      <Header user={user} />
      <main className="page">
        <header className="hero cat-hero" data-cat="journal">
          <div className="hero-top">
            <span className="ic-dot sq"><Icon name="pulse" size={24} /></span>
            <div>
              <h1>Dziennik objawów</h1>
              <p className="hero-sub">Ból, sen, lęk i nastrój w skali 0–10</p>
            </div>
          </div>
          <nav className="hero-actions" aria-label="Wnioski z wpisów">
            <Link href="/raport" className="btn">Raport</Link>
            <Link href="/obserwacje" className="btn ghost">Moje obserwacje</Link>
          </nav>
        </header>
        <SymptomStreak data={streak} className="streak-diary" />
        <SymptomsBoard key={initialDay || 'dzis'} initialDay={initialDay} />
      </main>
    </>
  );
}
