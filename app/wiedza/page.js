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

        {/* UI 4: artykuły jako zwijane karty (spis treści = lista); link /wiedza#id z wyszukiwarki rozwija artykuł (OpenOnHash) */}
        <h2 className="section-label">Artykuły</h2>
        <div className="stack read-list">
          {ARTICLES.map((a) => (
            <details key={a.id} id={a.id} className="card fold-card read-art">
              <summary><span className="lr-main">{a.title}</span><Icon name="chevronRight" size={18} className="lr-chev" /></summary>
              <div className="read-article">
                {a.text.map((p, i) => <p key={i}>{p}</p>)}
                {a.list && (
                  <dl className="klist">
                    {a.list.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}
                  </dl>
                )}
                {a.after && <p>{a.after}</p>}
                {a.sources && (
                  <>
                    <h3 className="section-label">Źródła</h3>
                    <ul className="sources small">
                      {a.sources.map((x) => <li key={x.url}><a href={x.url} target="_blank" rel="noopener noreferrer">{x.title}</a></li>)}
                    </ul>
                  </>
                )}
              </div>
            </details>
          ))}
        </div>

        <section id="katalog-terpenow" className="read-terps" aria-labelledby="terp-h">
          <h2 className="section-label" id="terp-h">Katalog terpenów</h2>
          <p className="muted small">Dotknij nazwy, aby zobaczyć aromat, miejsca występowania i to, co wiadomo z badań.</p>
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
        </section>
        <OpenOnHash />
      </main>
    </>
  );
}
