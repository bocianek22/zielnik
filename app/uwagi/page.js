import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { betaGroupUrl } from '@/lib/beta';
import Header from '../components/Header';
import FeedbackForm from './FeedbackForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Zgłoś uwagę' };

export default async function Uwagi({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const { ekran } = await searchParams;
  const items = await sql()`SELECT id, kind, body, status, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS at
    FROM beta_feedback WHERE user_id = ${user.id} ORDER BY created_at DESC, id DESC LIMIT 50`;
  return (
    <>
      <Header user={user} />
      <main className="page settings">
        <h1>Zgłoś uwagę</h1>
        <FeedbackForm initial={items} screen={typeof ekran === 'string' ? ekran.slice(0, 200) : null} groupUrl={betaGroupUrl()} />
      </main>
    </>
  );
}
