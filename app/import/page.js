import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import ImportForm from './ImportForm';
import RestoreForm from './RestoreForm';
import PageHero from '../components/PageHero';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <PageHero icon="upload" title="Import" sub="Odmiany z pliku lub kopii" />
        <Link href="/odmiany" className="back">← Wszystkie odmiany</Link>
        <ImportForm />
        <RestoreForm />
      </main>
    </>
  );
}
