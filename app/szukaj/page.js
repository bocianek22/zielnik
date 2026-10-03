import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { ARTICLES, TERPENES } from '@/lib/knowledge';
import { formLabel } from '@/lib/forms';
import { searchIndex } from '@/lib/search';
import { matches, rank } from '@/lib/searchMatch';
import { strainItems, catalogItems } from '@/lib/searchItems';
import Header from '../components/Header';
import Icon from '../components/Icon';
import SearchBox from './SearchBox';

const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : '');

// Grupa wyników: nagłówek sekcji i lista wierszy
function Group({ title, n, children }) {
  if (!n) return null;
  return (
    <section aria-label={title}>
      <h2 className="section-label">{title} ({n})</h2>
      <ul className="list">{children}</ul>
    </section>
  );
}

export const dynamic = 'force-dynamic';

export default async function Szukaj({ searchParams }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');

  const raw = String((await searchParams).q || '').trim().slice(0, 60);
  const q = raw.replace(/[%_\\]/g, '');
  // Spis służy podpowiedziom pod polem i wynikom poniżej, więc oba dopasowują tak samo (bez polskich znaków)
  const index = await searchIndex(me.id);
  // przeglądarka dostaje tylko pola potrzebne podpowiedziom
  const lite = {
    strains: index.strains.map(({ id, name, producer, taste, terpenes }) => ({ id, name, producer, taste, terpenes })),
    catalog: index.catalog.map(({ id, name, producer }) => ({ id, name, producer })),
    groups: index.groups,
  };
  let strains = [], users = [], catalog = [], groups = [];
  const terps = [], articles = [];
  const ranked = (items, list, max) => (rank([{ key: 'x', items }], q, { max, perGroup: max })[0]?.items || []).map((it) => list.find((x) => x.id === it.id));
  if (q) {
    strains = ranked(strainItems(index.strains), index.strains, 20);
    catalog = ranked(catalogItems(index.catalog), index.catalog, 10);
    groups = index.groups.filter((g) => matches(g.name, q)).slice(0, 10);
    for (const t of TERPENES) if (matches(`${t.name} ${t.aroma} ${t.found}`, q)) terps.push(t);
    for (const a of ARTICLES) if (matches(a.title, q)) articles.push(a);
  }
  // osoby: od 2 znaków, jak w podpowiedziach
  if (q.length >= 2) {
    const like = `%${q}%`;
    users = await sql()`SELECT u.username, u.display_name FROM users u
      WHERE u.id <> ${me.id}::int AND (u.username ILIKE ${like} OR u.display_name ILIKE ${like})
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ${me.id}::int AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = ${me.id}::int))
      ORDER BY lower(u.username) LIMIT 10`;
  }
  const total = strains.length + users.length + catalog.length + groups.length + terps.length + articles.length;

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <h1>Szukaj</h1>
        <SearchBox key={raw} initial={raw} index={lite} />
        {!q && <p className="search-hint">Podpowiedzi pojawiają się od pierwszej litery. Szukamy w odmianach, katalogu, terpenach, wiedzy, ludziach (od 2 znaków) i Twoich grupach.</p>}
        {q && total === 0 && (
          <div className="card empty">
            <Icon name="search" size={32} />
            <h2>Nic nie znaleziono</h2>
            <p>Brak wyników dla „{raw}”. Sprawdź pisownię albo wpisz krótszą frazę.</p>
          </div>
        )}
        <Group title="Odmiany" n={strains.length}>{strains.map((x) => (
          <li key={x.id}><Link href={`/strains/${x.id}`} className="list-row"><span className="lr-main"><b className="dn">{x.name}</b><span className="lr-sub dn">{x.producer}</span></span>
            {x.kind && <span className={`lr-value kind kind-${x.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(x.kind)}</span>}<Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
        <Group title="Katalog w Polsce" n={catalog.length}>{catalog.map((x) => (
          <li key={x.id}><Link href={`/katalog/${x.id}`} className="list-row"><span className="lr-main"><b className="dn">{x.name}</b><span className="lr-sub dn">{x.producer}</span></span>
            {x.form !== 'susz' && <span className="lr-value">{formLabel(x.form)}</span>}<Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
        <Group title="Terpeny" n={terps.length}>{terps.map((t) => (
          <li key={t.name}><Link href={`/wiedza#t-${t.name.toLowerCase().split(' ')[0]}`} className="list-row"><span className="lr-main"><b>{t.name}</b><span className="lr-sub">{t.aroma}</span></span><Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
        <Group title="Wiedza" n={articles.length}>{articles.map((a) => (
          <li key={a.id}><Link href={`/wiedza#${a.id}`} className="list-row"><span className="lr-main"><b>{a.title}</b></span><Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
        <Group title="Ludzie" n={users.length}>{users.map((u) => (
          <li key={u.username}><Link href={`/u/${encodeURIComponent(u.username)}`} className="list-row person-row"><span className="avatar-sm" aria-hidden="true">{(u.display_name || u.username)[0].toUpperCase()}</span>
            <span className="lr-main"><b>{u.display_name || u.username}</b><span className="lr-sub">@{u.username}</span></span><Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
        <Group title="Twoje grupy" n={groups.length}>{groups.map((g) => (
          <li key={g.id}><Link href={`/grupy/${g.id}`} className="list-row"><span className="lr-main"><b>{g.name}</b></span><Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
      </main>
    </>
  );
}
