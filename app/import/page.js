import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import Header from '../components/Header';
import ImportForm from './ImportForm';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Import z CSV</h1>
        <Link href="/" className="back">← Wszystkie odmiany</Link>
        <ImportForm />
      </main>
    </>
  );
}
