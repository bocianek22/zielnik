import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { visLabel } from '@/lib/visibility';
import Header from '../../components/Header';
import FriendButton from './FriendButton';
import Lightbox from '../../components/Lightbox';
import ProfileActions from './ProfileActions';
import ReportButton from '../../components/ReportButton';
import Icon from '../../components/Icon';

export const dynamic = 'force-dynamic';

const dec = (n) => Number(n).toLocaleString('pl-PL');
const day = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });

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

  const name = o.display_name || o.username;
  return (
    <>
      <Header user={me} />
      <main className="page social">
        <section className="card profile-card">
          <div className="profile-id">
            {o.ok && o.has_avatar ? <img className="avatar" src={`/api/users/${o.id}/avatar`} alt={`Awatar ${o.username}`} />
              : <div className="avatar ph" aria-hidden="true">{o.username[0].toUpperCase()}</div>}
            <div className="profile-who">
              <h1>{name}</h1>
              <span className="muted">@{o.username}</span>
              {status === 'friends' && <span className="profile-rel">Znajomy</span>}
            </div>
          </div>
          {o.ok ? (
            <>
              {o.bio && <p className="detail-desc profile-bio">{o.bio}</p>}
              {o.links?.length > 0 && <ul className="plinks">{o.links.map((l) => <li key={l}><a href={l} target="_blank" rel="nofollow noopener noreferrer ugc">{l.replace(/^https?:\/\//, '')}</a></li>)}</ul>}
            </>
          ) : <p className="muted profile-bio">Ten profil jest prywatny.</p>}
          <div className="profile-actions">
            {isMe ? <Link className="btn ghost" href="/profil">Edytuj profil</Link> : <FriendButton userId={o.id} status={status} />}
          </div>
        </section>

        {o.ok && (
          <>
            <h2 className="section-label">Oceny i opinie</h2>
            {opinions.length === 0 ? <p className="muted social-note">Brak widocznych opinii.</p> : (
              <ul className="list">{opinions.map((p) => (
                <li key={p.id}>
                  <Link href={`/strains/${p.id}`} className="list-row opinion-row">
                    <span className="lr-main">
                      <span className="person-name">{p.name}</span>
                      <span className="lr-sub">{p.producer}{isMe ? ` · ${visLabel(p.visibility)}` : ''}</span>
                      {p.notes && <span className="opinion-note">{p.notes}</span>}
                    </span>
                    {p.rating != null && <span className="lr-value rating-val"><b>{dec(p.rating)}</b>/10</span>}
                    <Icon name="chevronRight" size={20} className="lr-chev" />
                  </Link>
                </li>))}</ul>)}

            <h2 className="section-label">Testy</h2>
            {tests.length === 0 ? <p className="muted social-note">Brak widocznych testów.</p> : (
              <ul className="list">{tests.map((t) => (
                <li key={t.id} className="list-row wall-test">
                  {t.has_photo && <Lightbox className="test-photo" src={`/api/tests/${t.id}/photo?v=${t.pv}`} alt="Zdjęcie z testu" />}
                  <div className="lr-main">
                    <Link href={`/strains/${t.strain_id}`} className="person-name">{t.name}</Link>
                    <span className="lr-sub">{day(t.at)}{isMe ? ` · ${visLabel(t.visibility)}` : ''}</span>
                    {t.note && <span className="opinion-note">{t.note}</span>}
                    {!isMe && <ReportButton type="test" userId={o.id} refId={t.id} />}
                  </div>
                </li>))}</ul>)}
          </>
        )}

        {!isMe && <ProfileActions userId={o.id} blocked={!!blk} />}
      </main>
    </>
  );
}
