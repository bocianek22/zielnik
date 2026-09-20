import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql, ensureDb } from '@/lib/db';
import { ARTICLES, TERPENES } from '@/lib/knowledge';
import Header from '../components/Header';

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
        <form className="card row" method="get">
          <div className="field grow"><label htmlFor="q">Odmiany, producenci, terpeny, ludzie, grupy</label>
            <input id="q" name="q" className="input" defaultValue={raw} minLength={2} autoFocus /></div>
          <button className="btn">Szukaj</button>
        </form>
        {q.length >= 2 && total === 0 && <p className="muted">Nic nie znaleziono dla „{raw}”.</p>}
        {strains.length > 0 && <section className="card"><h2>Odmiany</h2><ul className="people">{strains.map((x) => (
          <li key={x.id} className="person"><Link href={`/strains/${x.id}`}><b>{x.name}</b> <span className="muted">{x.producer}</span></Link>{x.kind && <span className={`badge kind-${x.kind}`}>{x.kind}</span>}</li>))}</ul></section>}
        {catalog.length > 0 && <section className="card"><h2>Katalog w Polsce</h2><ul className="people">{catalog.map((x, i) => (
          <li key={i} className="person"><Link href="/katalog"><b>{x.name}</b> <span className="muted">{x.producer}</span></Link>{x.form !== 'susz' && <span className="badge form">{x.form}</span>}</li>))}</ul></section>}
        {terps.length > 0 && <section className="card"><h2>Terpeny</h2><ul className="people">{terps.map((t) => (
          <li key={t.name} className="person"><Link href={`/wiedza#t-${t.name.toLowerCase().split(' ')[0]}`}><b>{t.name}</b> <span className="muted">{t.aroma}</span></Link></li>))}</ul></section>}
        {articles.length > 0 && <section className="card"><h2>Wiedza</h2><ul className="people">{articles.map((a) => (
          <li key={a.id} className="person"><Link href={`/wiedza#${a.id}`}>{a.title}</Link></li>))}</ul></section>}
        {users.length > 0 && <section className="card"><h2>Ludzie</h2><ul className="people">{users.map((u) => (
          <li key={u.username} className="person"><Link href={`/u/${encodeURIComponent(u.username)}`}><b>{u.display_name || u.username}</b> <span className="muted">@{u.username}</span></Link></li>))}</ul></section>}
        {groups.length > 0 && <section className="card"><h2>Twoje grupy</h2><ul className="people">{groups.map((g) => (
          <li key={g.id} className="person"><Link href={`/grupy/${g.id}`}><b>{g.name}</b></Link></li>))}</ul></section>}
      </main>
    </>
  );
}
