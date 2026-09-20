import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import UsersAdmin from './UsersAdmin';
import InvitesAdmin from './InvitesAdmin';

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
        <section className="card">
          <h2>Kopia zapasowa</h2>
          <p className="muted">Plik JSON z całą bazą: odmiany, oceny, stany, pule, zakupy, zużycie, testy (bez zdjęć i bez haseł). Warto pobierać co jakiś czas.</p>
          <a className="btn ghost" href="/api/backup">Pobierz kopię zapasową</a>
        </section>
      </main>
    </>
  );
}
