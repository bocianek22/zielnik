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
        <h1>Dziennik objawów</h1>
        <SymptomsBoard />
        <h2 className="section-label">Wnioski z wpisów</h2>
        <nav className="list" aria-label="Wnioski z wpisów">
          <Link href="/obserwacje" className="list-row">
            <Icon name="chart" />
            <span className="lr-main">Moje obserwacje<span className="lr-sub">Średnie objawów w dniach z daną odmianą</span></span>
            <Icon name="chevronRight" size={18} className="lr-chev" />
          </Link>
        </nav>
      </main>
    </>
  );
}
