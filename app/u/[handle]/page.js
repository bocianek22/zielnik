import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { visLabel } from '@/lib/visibility';
import Header from '../../components/Header';
import FriendButton from './FriendButton';
import ProfileActions from './ProfileActions';
import ReportButton from '../../components/ReportButton';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }) {
  const me = await getUser();
  if (!me) redirect('/login');
  if (me.must_change_password) redirect('/change-password');

  const handle = decodeURIComponent((await params).handle);
  const q = sql();
  const [o] = await q`SELECT id, username, display_name, bio, links, (avatar IS NOT NULL) AS has_avatar, profile_visibility,
                             can_see(${me.id}::int, id, profile_visibility) AS ok FROM users WHERE lower(username) = lower(${handle})`;
  if (!o) notFound();
  const isMe = o.id === me.id;
  const fr = await q`SELECT status, requester FROM friendships
                     WHERE (requester = ${me.id} AND addressee = ${o.id}) OR (requester = ${o.id} AND addressee = ${me.id})`;
  const status = isMe ? 'me' : !fr.length ? 'none' : fr[0].status === 'accepted' ? 'friends' : fr[0].requester === me.id ? 'outgoing' : 'incoming';

  const [blk] = isMe ? [null] : await q`SELECT 1 AS x FROM blocks WHERE blocker = ${me.id} AND blocked = ${o.id}`;
  let opinions = [], tests = [];
  if (o.ok) {
    opinions = await q`SELECT s.id, s.name, s.producer, us.rating::float8 AS rating, us.notes, us.visibility
      FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.user_id = ${o.id} AND can_see(${me.id}::int, us.user_id, us.visibility) AND (us.rating IS NOT NULL OR us.notes <> '')
      ORDER BY us.updated_at DESC LIMIT 50`;
    tests = await q`SELECT t.id, t.note, (t.data IS NOT NULL) AS has_photo, t.visibility, floor(extract(epoch FROM COALESCE(t.updated_at, t.created_at)))::int AS pv, s.id AS strain_id, s.name,
        to_char(t.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS at
      FROM strain_tests t JOIN strains s ON s.id = t.strain_id
      WHERE t.user_id = ${o.id} AND can_see(${me.id}::int, t.user_id, t.visibility) ORDER BY t.created_at DESC LIMIT 30`;
  }

  return (
    <>
      <Header user={me} />
      <main className="page stack">
        <section className="card profile-head">
          {o.ok && o.has_avatar ? <img className="avatar" src={`/api/users/${o.id}/avatar`} alt={`Awatar ${o.username}`} />
            : <div className="avatar ph" aria-hidden="true">{o.username[0].toUpperCase()}</div>}
          <div className="profile-info">
            <h1>{o.display_name || o.username}</h1>
            <p className="muted">@{o.username}</p>
            {o.ok ? (
              <>
                {o.bio && <p className="detail-desc">{o.bio}</p>}
                {o.links?.length > 0 && <ul className="plinks">{o.links.map((l) => <li key={l}><a href={l} target="_blank" rel="nofollow noopener noreferrer ugc">{l.replace(/^https?:\/\//, '')}</a></li>)}</ul>}
              </>
            ) : <p className="muted">Ten profil jest prywatny.</p>}
            {isMe ? <Link className="btn ghost small" href="/profil">Edytuj profil</Link> : <><FriendButton userId={o.id} status={status} /><ProfileActions userId={o.id} blocked={!!blk} /></>}
          </div>
        </section>

        {o.ok && (
          <>
            <section className="card">
              <h2>Oceny i opinie</h2>
              {opinions.length === 0 ? <p className="muted">Brak widocznych opinii.</p> : (
                <ul className="wall">{opinions.map((p) => (
                  <li key={p.id}>
                    <p><Link href={`/strains/${p.id}`}><b>{p.name}</b></Link> <span className="muted">{p.producer}</span>
                      {p.rating != null && <span className="pill">{p.rating}/10</span>}
                      {isMe && <span className="badge">{visLabel(p.visibility)}</span>}</p>
                    {p.notes && <p className="detail-desc">{p.notes}</p>}
                  </li>))}</ul>)}
            </section>
            <section className="card">
              <h2>Testy</h2>
              {tests.length === 0 ? <p className="muted">Brak widocznych testów.</p> : (
                <ul className="wall">{tests.map((t) => (
                  <li key={t.id} className="wall-test">
                    {t.has_photo && <img className="test-photo" src={`/api/tests/${t.id}/photo?v=${t.pv}`} alt="Zdjęcie z testu" loading="lazy" />}
                    <div><p><Link href={`/strains/${t.strain_id}`}><b>{t.name}</b></Link> <span className="muted">{t.at}</span>
                      {isMe && <span className="badge">{visLabel(t.visibility)}</span>}{!isMe && <ReportButton type="test" userId={o.id} refId={t.id} />}</p>
                      {t.note && <p className="detail-desc">{t.note}</p>}</div>
                  </li>))}</ul>)}
            </section>
          </>
        )}
      </main>
    </>
  );
}
