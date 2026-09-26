import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { canUse, PLAN_FEATURES } from '@/lib/plans';
import Header from '../components/Header';

export const dynamic = 'force-dynamic';

export default async function Premium() {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  await ensureDb();
  const [row] = await sql()`SELECT plan, to_char(plan_until AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS plan_until, plan_until AS raw FROM users WHERE id = ${me.id}`;
  const enforced = process.env.PREMIUM_ENFORCED === '1';
  const isPremium = canUse({ plan: row.plan, plan_until: row.raw }, 'doctor_report') && (row.plan === 'premium');
  const donate = process.env.DONATE_URL;

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <h1>Premium i wsparcie</h1>
        <section className="card">
          <p>Twój plan: <b>{row.plan === 'premium' ? 'Premium' : 'Darmowy'}</b>{row.plan === 'premium' && row.plan_until && <> (ważny do {row.plan_until})</>}.</p>
          {!enforced && <p className="muted">Na razie wszystkie funkcje są dostępne bezpłatnie. Gdy uruchomimy płatności, podstawowe funkcje pozostaną darmowe, a płatne będą wyłącznie te oznaczone poniżej jako Premium.</p>}
        </section>
        <section className="card">
          <h2>Co jest w planach</h2>
          <div className="table-wrap"><table className="cmp"><thead><tr><th>Funkcja</th><th>Darmowy</th><th>Premium</th></tr></thead>
            <tbody>{PLAN_FEATURES.map(([label, tier]) => (
              <tr key={label}><td>{label}</td><td>{tier === 'free' ? '✓' : '–'}</td><td>✓</td></tr>))}</tbody></table></div>
          <p className="muted small">Nigdy nie sprzedajemy danych ani nie pokazujemy reklam produktów leczniczych i aptek.</p>
        </section>
        <section className="card">
          <h2>Wesprzyj projekt</h2>
          <p>Zielnik utrzymuje się z dobrowolnego wsparcia użytkowników i, w przyszłości, z planu Premium. Każda wpłata pokrywa serwer, bazę danych i rozwój.</p>
          {donate ? <a className="btn" href={donate} target="_blank" rel="noopener noreferrer">Wesprzyj Zielnik</a>
            : <p className="muted">Link do wpłat zostanie dodany wkrótce.</p>}
        </section>
      </main>
    </>
  );
}
