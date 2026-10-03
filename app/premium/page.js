import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { PLAN_FEATURES } from '@/lib/plans';
import Header from '../components/Header';

export const dynamic = 'force-dynamic';

const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function Premium() {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  await ensureDb();
  const [row] = await sql()`SELECT plan, to_char(plan_until AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS plan_until, plan_until AS raw FROM users WHERE id = ${me.id}`;
  // plan Premium bez daty końca albo jeszcze nieprzeterminowany (jak w canUse z lib/plans.js)
  const isPremium = row.plan === 'premium' && (!row.raw || new Date(row.raw) > new Date());
  const enforced = process.env.PREMIUM_ENFORCED === '1';
  const donate = process.env.DONATE_URL;

  const expired = !isPremium && row.plan === 'premium';
  return (
    <>
      <Header user={me} />
      <main className="page read plan-page">
        <h1>Premium i wsparcie</h1>

        <h2 className="section-label">Twój plan</h2>
        <section className="card">
          <dl className="facts">
            <div><dt>Plan</dt><dd>{isPremium ? 'Premium' : 'Darmowy'}</dd></div>
            {row.plan_until && (isPremium || expired) && <div><dt>{isPremium ? 'Ważny do' : 'Wygasł'}</dt><dd>{day(row.plan_until)}</dd></div>}
          </dl>
          {!enforced && <p className="muted plan-note">Na razie wszystkie funkcje są dostępne bezpłatnie. Gdy uruchomimy płatności, podstawowe funkcje pozostaną darmowe, a płatne będą wyłącznie te oznaczone poniżej jako Premium.</p>}
        </section>

        <h2 className="section-label">Co obejmują plany</h2>
        <ul className="list plan-list">
          {PLAN_FEATURES.map(([label, tier]) => (
            <li key={label} className="list-row">
              <span className="lr-main">{label}</span>
              <span className={`plan-tag${tier === 'free' ? '' : ' pro'}`}>{tier === 'free' ? 'Darmowy' : 'Premium'}</span>
            </li>))}
        </ul>
        <p className="muted small plan-foot">Premium obejmuje też wszystkie funkcje planu Darmowego. Nigdy nie sprzedajemy danych ani nie pokazujemy reklam produktów leczniczych i aptek.</p>

        <h2 className="section-label">Wesprzyj projekt</h2>
        <section className="card">
          <p>Zielnik utrzymuje się z dobrowolnego wsparcia użytkowników i, w przyszłości, z planu Premium. Każda wpłata pokrywa serwer, bazę danych i rozwój.</p>
          {donate ? <a className="btn block" href={donate} target="_blank" rel="noopener noreferrer">Wesprzyj Zielnik</a>
            : <p className="muted">Link do wpłat zostanie dodany wkrótce.</p>}
        </section>
      </main>
    </>
  );
}
