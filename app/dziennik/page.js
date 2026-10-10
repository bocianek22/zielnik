import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import Icon from '../components/Icon';
import SymptomsBoard from './SymptomsBoard';

export const dynamic = 'force-dynamic';

export default async function Dziennik() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
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
        <SymptomsBoard />
      </main>
    </>
  );
}
