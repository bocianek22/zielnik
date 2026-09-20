import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import Header from '../../components/Header';
import GroupActions from './GroupActions';

export const dynamic = 'force-dynamic';

export default async function GroupPage({ params }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  const gid = Number((await params).id);
  if (!Number.isInteger(gid)) notFound();
  const q = sql();
  const [g] = await q`SELECT g.id, g.name, g.description, gm.role FROM groups g
                      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = ${me.id} AND gm.status = 'active' WHERE g.id = ${gid}`;
  if (!g) notFound();
  const members = await q`SELECT u.id, u.username, u.display_name, gm.role, gm.status FROM group_members gm
                          JOIN users u ON u.id = gm.user_id WHERE gm.group_id = ${gid} ORDER BY (gm.status = 'active') DESC, lower(u.username)`;
  // ranking grupy: suma ocen członków, które widzisz (wg ich ustawień widoczności)
  const ranking = await q`SELECT s.id, s.name, s.producer, SUM(us.rating)::float8 AS sum, COUNT(*)::int AS n
    FROM group_members gm JOIN user_strain us ON us.user_id = gm.user_id AND us.rating IS NOT NULL
    JOIN strains s ON s.id = us.strain_id
    WHERE gm.group_id = ${gid} AND gm.status = 'active' AND can_see(${me.id}::int, us.user_id, us.visibility)
    GROUP BY s.id ORDER BY sum DESC, n DESC, s.name LIMIT 20`;

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <Link href="/grupy" className="back">← Wszystkie grupy</Link>
        <section className="card">
          <h1>{g.name}</h1>
          {g.description && <p>{g.description}</p>}
          <GroupActions groupId={g.id} isOwner={g.role === 'owner'} />
        </section>
        <section className="card"><h2>Członkowie</h2>
          <ul className="people">{members.map((m) => (
            <li key={m.id} className="person"><Link href={`/u/${encodeURIComponent(m.username)}`}><b>{m.display_name || m.username}</b> <span className="muted">@{m.username}</span></Link>
              <span className="row">{m.role === 'owner' && <span className="badge">Właściciel</span>}{m.status === 'invited' && <span className="badge">Zaproszony</span>}
                {g.role === 'owner' && m.id !== me.id && <GroupActions groupId={g.id} kickId={m.id} />}</span></li>))}</ul>
        </section>
        <section className="card"><h2>Ranking grupy</h2>
          <p className="muted">Suma ocen członków, które są dla Ciebie widoczne.</p>
          {ranking.length === 0 ? <p className="muted">Brak widocznych ocen.</p> : (
            <ol className="rank-list">{ranking.map((r, i) => (
              <li key={r.id} className={i < 3 ? `top top-${i + 1}` : ''}><span className="pos">{i + 1}</span>
                <span className="who"><Link href={`/strains/${r.id}`}><b>{r.name}</b></Link><small>{r.producer}</small></span>
                <span className="pts">{Number(r.sum.toFixed(1))}<small>{r.n} ocen, śr. {(r.sum / r.n).toFixed(1)}</small></span></li>))}</ol>)}
        </section>
      </main>
    </>
  );
}
