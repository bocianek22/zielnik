import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { ARTICLES, TERPENES } from '@/lib/knowledge';
import { formLabel } from '@/lib/forms';
import Header from '../components/Header';
import Icon from '../components/Icon';

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
  let strains = [], users = [], catalog = [], groups = [];
  const terps = [], articles = [];
  if (q.length >= 2) {
    await ensureDb();
    const like = `%${q}%`, s = sql();
    strains = await s`SELECT id, name, producer, kind FROM strains WHERE name ILIKE ${like} OR producer ILIKE ${like} ORDER BY name LIMIT 20`;
    users = await s`SELECT u.username, u.display_name FROM users u
      WHERE u.id <> ${me.id}::int AND (u.username ILIKE ${like} OR u.display_name ILIKE ${like})
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ${me.id}::int AND b.blocked = u.id) OR (b.blocker = u.id AND b.blocked = ${me.id}::int))
      ORDER BY lower(u.username) LIMIT 10`;
    catalog = await s`SELECT name, producer, form FROM market_catalog WHERE active AND (name ILIKE ${like} OR producer ILIKE ${like}) ORDER BY name LIMIT 10`;
    groups = await s`SELECT g.id, g.name FROM groups g JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ${me.id}::int AND gm.status = 'active'
      WHERE g.name ILIKE ${like} ORDER BY g.name LIMIT 10`;
    const ql = q.toLowerCase();
    for (const t of TERPENES) if (`${t.name} ${t.aroma} ${t.found}`.toLowerCase().includes(ql)) terps.push(t);
    for (const a of ARTICLES) if (a.title.toLowerCase().includes(ql)) articles.push(a);
  }
  const total = strains.length + users.length + catalog.length + groups.length + terps.length + articles.length;

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <h1>Szukaj</h1>
        <form className="search-form" method="get" role="search">
          <div className="search-wrap">
            <Icon name="search" size={20} />
            <input id="q" name="q" type="search" className="input search" defaultValue={raw} minLength={2} autoFocus aria-label="Szukaj" placeholder="Odmiana, producent, terpen, osoba…" />
          </div>
          <button className="btn">Szukaj</button>
        </form>
        {q.length < 2 && <p className="search-hint">Wpisz co najmniej 2 znaki. Szukamy w odmianach, katalogu, terpenach, wiedzy, ludziach i Twoich grupach.</p>}
        {q.length >= 2 && total === 0 && (
          <div className="card empty">
            <Icon name="search" size={32} />
            <h2>Nic nie znaleziono</h2>
            <p>Brak wyników dla „{raw}”. Sprawdź pisownię albo wpisz krótszą frazę.</p>
          </div>
        )}
        <Group title="Odmiany" n={strains.length}>{strains.map((x) => (
          <li key={x.id}><Link href={`/strains/${x.id}`} className="list-row"><span className="lr-main"><b className="dn">{x.name}</b><span className="lr-sub dn">{x.producer}</span></span>
            {x.kind && <span className={`lr-value kind kind-${x.kind}`}><i className="kind-dot" aria-hidden="true" />{cap(x.kind)}</span>}<Icon name="chevronRight" size={20} className="lr-chev" /></Link></li>))}</Group>
        <Group title="Katalog w Polsce" n={catalog.length}>{catalog.map((x, i) => (
          <li key={i}><Link href="/katalog" className="list-row"><span className="lr-main"><b className="dn">{x.name}</b><span className="lr-sub dn">{x.producer}</span></span>
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
