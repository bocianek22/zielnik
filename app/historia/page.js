import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { history } from '@/lib/strains';
import Header from '../components/Header';

export const dynamic = 'force-dynamic';

export default async function Historia() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const { purchases, usage } = await history(user.id);

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Historia</h1>
        <div className="rank-grid two">
          <section className="card">
            <h2>Zakupy</h2>
            {purchases.length === 0 ? <p className="muted">Brak zakupów. Dodaj je w karcie odmiany (pole „Wykupiłem”).</p> : (
              <div className="table-wrap"><table className="cmp"><thead><tr><th>Data</th><th>Odmiana</th><th>Ilość</th><th>Koszt</th></tr></thead>
                <tbody>{purchases.map((p, i) => (
                  <tr key={i}><td>{p.at}</td><td>{p.name}</td><td>{p.grams} g</td><td>{p.cost != null ? `${p.cost} zł` : '–'}</td></tr>
                ))}</tbody></table></div>
            )}
          </section>
          <section className="card">
            <h2>Zużycie</h2>
            {usage.length === 0 ? <p className="muted">Brak wpisów. Dodaj je w karcie odmiany (pole „Zużycie”).</p> : (
              <div className="table-wrap"><table className="cmp"><thead><tr><th>Data</th><th>Odmiana</th><th>Ilość</th></tr></thead>
                <tbody>{usage.map((u, i) => (
                  <tr key={i}><td>{u.at}</td><td>{u.name}</td><td>{u.grams} g</td></tr>
                ))}</tbody></table></div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
