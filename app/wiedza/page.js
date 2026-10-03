import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { ARTICLES, TERPENES } from '@/lib/knowledge';
import Header from '../components/Header';
import Icon from '../components/Icon';
import OpenOnHash from './OpenOnHash';

export const dynamic = 'force-dynamic';

export default async function Wiedza() {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  return (
    <>
      <Header user={user} />
      <main className="page read" id="top">
        <h1>Wiedza</h1>
        <div className="alert note read-note" role="note">
          <Icon name="info" size={20} />
          <p>Materiały mają charakter edukacyjny i nie zastępują porady lekarza. Wiele opisanych działań terpenów pochodzi z badań na zwierzętach lub komórkach. O doborze odmiany decyduj razem z lekarzem prowadzącym.</p>
        </div>

        <nav aria-label="Spis treści">
          <h2 className="section-label">Spis treści</h2>
          <ul className="list toc">
            {ARTICLES.map((a) => (
              <li key={a.id}><a className="list-row" href={`#${a.id}`}><span className="lr-main">{a.title}</span><Icon name="chevronRight" size={20} className="lr-chev" /></a></li>
            ))}
            <li><a className="list-row" href="#katalog-terpenow"><span className="lr-main">Katalog terpenów</span><Icon name="chevronRight" size={20} className="lr-chev" /></a></li>
          </ul>
        </nav>

        {ARTICLES.map((a) => (
          <article key={a.id} id={a.id} className="read-article">
            <h2>{a.title}</h2>
            {a.text.map((p, i) => <p key={i}>{p}</p>)}
            {a.list && (
              <dl className="klist">
                {a.list.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
              </dl>
            )}
            {a.after && <p>{a.after}</p>}
            <a className="to-top" href="#top">Do spisu treści</a>
          </article>
        ))}

        <section id="katalog-terpenow" className="read-article">
          <h2>Katalog terpenów</h2>
          <p className="muted">Dotknij nazwy, aby zobaczyć aromat, miejsca występowania i to, co wiadomo z badań.</p>
          <ul className="list terp-list">
            {TERPENES.map((t) => (
              <li key={t.name}>
                <details id={`t-${t.name.toLowerCase().split(' ')[0]}`} className="terp">
                  <summary className="list-row">
                    <span className="lr-main"><span className="terp-name">{t.name}</span><span className="lr-sub">{t.aroma}</span></span>
                    <Icon name="chevronDown" size={20} className="lr-chev" />
                  </summary>
                  <dl className="terp-body">
                    <div><dt>Znajdziesz też w</dt><dd>{t.found}</dd></div>
                    <div><dt>Co wiadomo</dt><dd>{t.known}</dd></div>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
          <a className="to-top" href="#top">Do spisu treści</a>
        </section>
        <OpenOnHash />
      </main>
    </>
  );
}
