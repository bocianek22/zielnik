import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { intId } from '@/lib/ids';
import { sql } from '@/lib/db';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';
import Icon from '../../components/Icon';
import GroupActions from './GroupActions';
import GroupChat from './GroupChat';
import osob, { ocen } from '../osob';

export const dynamic = 'force-dynamic';

// kogo pokazać z przyciskami: właściciel wszystkich (poza właścicielem), moderator tylko zwykłych członków
const canManage = (viewerRole, m) => m.role !== 'owner' && (viewerRole === 'owner' || (viewerRole === 'moderator' && m.role === 'member'));
const dec = (n) => Number(n.toFixed(1)).toLocaleString('pl-PL');

export default async function GroupPage({ params }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');
  const gid = intId((await params).id);
  if (!gid) notFound();
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
  const active = members.filter((m) => m.status === 'active').length;

  return (
    <>
      <Header user={me} />
      <main className="page social">
        <Link href="/grupy" className="back"><Icon name="chevronLeft" size={20} />Wszystkie grupy</Link>
        <header className="group-head">
          <h1>{g.name}</h1>
          <p className="muted">{osob(active)}{g.role === 'owner' ? ' · jesteś właścicielem' : g.role === 'moderator' ? ' · jesteś moderatorem' : ''}</p>
          {g.description && <p className="group-desc">{g.description}</p>}
        </header>

        <section className="card tint chat-card" data-cat="social" aria-labelledby="czat">
          <div className="sec-head"><span className="ic-dot sm" aria-hidden="true"><Icon name="group" size={18} /></span><h2 id="czat">Czat</h2></div>
          <GroupChat groupId={g.id} />
        </section>

        <h2 className="section-label">Zaproś do grupy</h2>
        <GroupActions groupId={g.id} isOwner={g.role === 'owner'} />

        <h2 className="section-label">Członkowie</h2>
        <ul className="list">{members.map((m) => {
          const name = m.display_name || m.username;
          return (
            <li key={m.id} className="list-row person-row">
              <Avatar name={name} />
              <Link href={`/u/${encodeURIComponent(m.username)}`} className="lr-main person-link">
                <span className="person-name">{name}</span>
                <span className="lr-sub">@{m.username}{m.role === 'owner' ? ' · Właściciel' : m.role === 'moderator' ? ' · Moderator' : ''}{m.status === 'invited' ? ' · Zaproszony' : ''}</span>
              </Link>
              {canManage(g.role, m) && m.id !== me.id && (
                <span className="person-actions">
                  <GroupActions groupId={g.id} kickId={m.id} kickName={name} viewerRole={g.role} memberRole={m.status === 'invited' ? 'invited' : m.role} />
                </span>)}
            </li>);
        })}</ul>

        <h2 className="section-label">Ranking grupy</h2>
        <p className="muted social-note">Suma ocen członków, które są dla Ciebie widoczne.</p>
        {ranking.length === 0 ? <p className="muted social-note">Brak widocznych ocen.</p> : (
          <ol className="list rank-rows">{ranking.map((r, i) => (
            <li key={r.id}>
              <Link href={`/strains/${r.id}`} className="list-row">
                <span className="rank-pos">{i + 1}</span>
                <span className="lr-main"><span className="person-name dn">{r.name}</span><span className="lr-sub dn">{r.producer}</span></span>
                <span className="lr-value rank-sum"><b>{dec(r.sum)}</b><small>{ocen(r.n)}, śr. {dec(r.sum / r.n)}</small></span>
              </Link>
            </li>))}</ol>)}

        <h2 className="section-label">Członkostwo</h2>
        <GroupActions groupId={g.id} isOwner={g.role === 'owner'} part="leave" />
      </main>
    </>
  );
}
