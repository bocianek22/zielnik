import Link from 'next/link';
import { unitOf } from '@/lib/units';
import { intId } from '@/lib/ids';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { isNativeApp } from '@/lib/client';
import { listStrains } from '@/lib/strains';
import { strainStats } from '@/lib/strain-stats';
import { formatDay } from '@/lib/date';
import Header from '../components/Header';
import Icon from '../components/Icon';

export const dynamic = 'force-dynamic';

const pl = (x, digits) => Number(x).toLocaleString('pl-PL', digits == null ? undefined : { minimumFractionDigits: digits, maximumFractionDigits: digits });
const avg = (s) => {
  const r = s.entries.filter((e) => e.rating != null);
  return r.length ? pl(r.reduce((a, e) => a + Number(e.rating), 0) / r.length, 1) : '–';
};

export default async function Compare({ searchParams }) {
  const user = await getUser();
  if (!user) redirect('/login');
  if (user.must_change_password) redirect('/change-password');

  const ids = String((await searchParams).ids || '').split(',').map(intId).filter(Boolean).slice(0, 3);
  const all = ids.length ? await listStrains(user.id, { ids }) : [];
  const rows = ids.map((id) => all.find((s) => s.id === id)).filter(Boolean);
  const mine = (s) => s.entries.find((e) => e.userId === user.id);
  // POM-18: moje statystyki odmiany (tylko moje zużycie, jak na stronie odmiany)
  const stats = Object.fromEntries(await Promise.all(rows.map(async (s) => [s.id, await strainStats(user.id, s.id)])));
  // krótko (3 kolumny na 320 px), pełna data w podpowiedzi
  const ago = (st) => (st.lastUse == null ? '–' : (
    <span title={formatDay(st.lastUse)}>{st.lastDaysAgo === 0 ? 'dziś' : st.lastDaysAgo === 1 ? 'wczoraj' : `${st.lastDaysAgo} dni temu`}</span>));
  // liczby z polskim przecinkiem, brak wartości jako kreska
  const v = (x, unit = '') => (x == null || x === '' ? '–' : `${Number.isNaN(Number(x)) ? x : pl(x)}${unit}`);
  const cap = (x) => (x ? <span className="cap">{x}</span> : '–');

  const lines = [
    ['Producent', (s) => (s.producer ? <span className="dn">{s.producer}</span> : '–')],
    ['Rodzaj', (s) => cap(s.kind)],
    ['Typ', (s) => cap(s.type)],
    ['THC', (s) => v(s.thc, '%')],
    ['CBD', (s) => v(s.cbd, '%')],
    // w aplikacji natywnej bez cen (lib/client.js)
    ...(isNativeApp(await headers()) ? [] : [['Cena za g / ml', (s) => v(s.price_per_g, ` zł/${unitOf(s.form)}`)]]),
    ['Ocena końcowa', (s) => v(s.final_rating)],
    ['Średnia ocen', avg],
    ['Twoja ocena', (s) => v(mine(s)?.rating)],
    ['Smak', (s) => v(s.taste)],
    ['Terpeny', (s) => (s.terpenes?.length ? <span className="dn">{s.terpenes.join(', ')}</span> : '–')],
    ['Mam teraz', (s) => v(mine(s)?.current, ` ${unitOf(s.form)}`)],
    ['Do wykupienia (pula)', (s) => v(mine(s)?.remaining, ` ${unitOf(s.form)}`)],
    ['Zużyłem razem', (s) => (stats[s.id].uses ? `${pl(stats[s.id].used)} ${unitOf(s.form)}` : '–')],
    ['Średnio dziennie (12 tyg.)', (s) => v(stats[s.id].perDay, ` ${unitOf(s.form)}`)],
    ['Ostatnie użycie', (s) => ago(stats[s.id])],
  ];

  return (
    <>
      <Header user={user} />
      <main className="page">
        <Link href="/odmiany" className="back"><Icon name="chevronLeft" size={20} />Wszystkie odmiany</Link>
        <h1>Porównanie</h1>
        {rows.length < 2 ? (
          <div className="empty">
            <Icon name="list" size={32} />
            <h2>Wybierz odmiany do porównania</h2>
            <p>Zaznacz na liście co najmniej dwie odmiany (pole „Porównaj”) i otwórz porównanie.</p>
            <Link className="btn" href="/odmiany">Wróć do odmian</Link>
          </div>
        ) : (
          <div className="card cmp-board" style={{ '--n': rows.length }}>
            <div className="cmp-head">
              <span className="cmp-spacer" aria-hidden="true" />
              {rows.map((s) => <Link key={s.id} href={`/strains/${s.id}`} className="dn">{s.name}</Link>)}
            </div>
            <dl className="cmp-lines">
              {lines.map(([label, fn]) => (
                <div key={label} className="cmp-line">
                  <dt>{label}</dt>
                  {rows.map((s) => <dd key={s.id}>{fn(s)}</dd>)}
                </div>
              ))}
            </dl>
          </div>
        )}
      </main>
    </>
  );
}
