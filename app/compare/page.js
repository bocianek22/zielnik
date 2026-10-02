import Link from 'next/link';
import { intId } from '@/lib/ids';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { listStrains } from '@/lib/strains';
import Header from '../components/Header';

export const dynamic = 'force-dynamic';

const avg = (s) => {
  const r = s.entries.filter((e) => e.rating != null);
  return r.length ? (r.reduce((a, e) => a + Number(e.rating), 0) / r.length).toFixed(1) : '–';
};

export default async function Compare({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const ids = String((await searchParams).ids || '').split(',').map(intId).filter(Boolean).slice(0, 3);
  const all = ids.length ? await listStrains(user.id, { ids }) : [];
  const rows = ids.map((id) => all.find((s) => s.id === id)).filter(Boolean);
  const mine = (s) => s.entries.find((e) => e.userId === user.id);
  const v = (x, unit = '') => (x == null || x === '' ? '–' : `${x}${unit}`);

  const lines = [
    ['Producent', (s) => <span className="dn">{s.producer}</span>],
    ['Rodzaj', (s) => v(s.kind)],
    ['Typ', (s) => s.type],
    ['THC', (s) => v(s.thc, '%')],
    ['CBD', (s) => v(s.cbd, '%')],
    // w aplikacji natywnej bez cen (lib/client.js)
    ...(isNativeApp(await headers()) ? [] : [['Cena za gram', (s) => v(s.price_per_g, ' zł')]]),
    ['Ocena końcowa', (s) => v(s.final_rating)],
    ['Średnia ocen', avg],
    ['Twoja ocena', (s) => v(mine(s)?.rating)],
    ['Smak', (s) => v(s.taste)],
    ['Terpeny', (s) => (s.terpenes?.length ? <span className="dn">{s.terpenes.join(', ')}</span> : '–')],
    ['Mam teraz', (s) => v(mine(s)?.current, ' g')],
    ['Do wykupienia (pula)', (s) => v(mine(s)?.remaining, ' g')],
  ];

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Porównanie</h1>
        <Link href="/" className="back">← Wszystkie odmiany</Link>
        {rows.length < 2 ? (
          <div className="card empty"><p className="muted">Zaznacz na liście co najmniej dwie odmiany (pole „Porównaj”) i kliknij przycisk porównania.</p></div>
        ) : (
          <div className="table-wrap card">
            <table className="cmp">
              <thead>
                <tr><th />{rows.map((s) => <th key={s.id}><Link href={`/strains/${s.id}`} className="dn">{s.name}</Link></th>)}</tr>
              </thead>
              <tbody>
                {lines.map(([label, fn]) => (
                  <tr key={label}><th scope="row">{label}</th>{rows.map((s) => <td key={s.id}>{fn(s)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
