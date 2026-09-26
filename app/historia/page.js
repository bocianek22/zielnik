import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { history } from '@/lib/strains';
import Header from '../components/Header';

export const dynamic = 'force-dynamic';

export default async function Historia() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');
  const { purchases, usage, weekly, top } = await history(user.id);
  const max = Math.max(1, ...weekly.map((w) => w.grams));

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Historia</h1>
        <section className="card usage-chart">
          <h2>Zużycie tygodniowe (ostatnie 8 tygodni)</h2>
          {weekly.every((w) => w.grams === 0) ? <p className="muted">Brak danych. Wpisuj zużycie w karcie odmiany.</p> : (
            <svg viewBox="0 0 400 170" className="bars" role="img" aria-label="Wykres zużycia tygodniowego w gramach">
              {weekly.map((w, i) => {
                const h = (w.grams / max) * 110, x = 12 + i * 47;
                return (
                  <g key={w.label}>
                    <rect x={x} y={130 - h} width="34" height={h} rx="5" fill="#5f9a4a" />
                    <text x={x + 17} y={124 - h} textAnchor="middle" fontSize="11" fill="#1d3b27">{w.grams ? Number(w.grams.toFixed(1)) : ''}</text>
                    <text x={x + 17} y={150} textAnchor="middle" fontSize="10" fill="#5f7064">{w.label}</text>
                  </g>
                );
              })}
            </svg>
          )}
          {top.length > 0 && (
            <>
              <h3>Najczęściej używane (30 dni)</h3>
              <ol className="toplist">{top.map((t) => <li key={t.name}><b>{t.name}</b> {Number(t.grams.toFixed(2))} g</li>)}</ol>
            </>
          )}
        </section>
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
