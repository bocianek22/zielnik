import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ARTICLES, TERPENES } from '@/lib/knowledge';
import Header from '../components/Header';

export const dynamic = 'force-dynamic';

export default async function Wiedza() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  return (
    <>
      <Header user={user} />
      <main className="page">
        <h1>Wiedza</h1>
        <div className="alert note">Materiały mają charakter edukacyjny i nie zastępują porady lekarza. Wiele opisanych działań terpenów pochodzi z badań na zwierzętach lub komórkach. O doborze odmiany decyduj razem z lekarzem prowadzącym.</div>
        <nav className="knav" aria-label="Spis treści">
          {ARTICLES.map((a) => <a key={a.id} href={`#${a.id}`}>{a.title}</a>)}
          <a href="#katalog-terpenow">Katalog terpenów</a>
        </nav>

        <div className="stack">
          {ARTICLES.map((a) => (
            <article key={a.id} id={a.id} className="card knowledge">
              <h2>{a.title}</h2>
              {a.text.map((p, i) => <p key={i}>{p}</p>)}
              {a.list && (
                <dl className="klist">
                  {a.list.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
                </dl>
              )}
              {a.after && <p>{a.after}</p>}
            </article>
          ))}

          <section id="katalog-terpenow">
            <h2>Katalog terpenów</h2>
            <div className="terp-grid">
              {TERPENES.map((t) => (
                <article key={t.name} id={`t-${t.name.toLowerCase().split(' ')[0]}`} className="card terp-card">
                  <h3>{t.name}</h3>
                  <p><b>Aromat:</b> {t.aroma}</p>
                  <p><b>Znajdziesz też w:</b> {t.found}</p>
                  <p><b>Co wiadomo:</b> {t.known}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
