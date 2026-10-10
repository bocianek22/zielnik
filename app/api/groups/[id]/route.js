import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';

// { action: 'invite' | 'accept' | 'leave' | 'kick' | 'mod' | 'unmod' | 'transfer' | 'delete', username?, userId? }
// Role (SPO-3): owner (jeden na grupę), moderator (nadaje właściciel), member. Uprawnienia sprawdza samo zapytanie
// (członkostwo i rola wywołującego w WHERE), więc wyrzucenie z grupy albo odebranie roli działa od razu.
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const gid = intId((await params).id);
  const b = await jsonBody(req);
  const q = sql();
  const [m] = await q`SELECT role, status FROM group_members WHERE group_id = ${gid} AND user_id = ${user.id}`;
  if (!m) return bad('Nie należysz do tej grupy.', 403);

  if (b.action === 'accept') {
    if (m.status !== 'invited') return bad('Brak zaproszenia.');
    // historia sprzed dołączenia nie liczy się jako nieprzeczytana
    await q`UPDATE group_members SET status = 'active',
              last_read_message_id = (SELECT COALESCE(max(id), 0) FROM group_messages WHERE group_id = ${gid}::int)
            WHERE group_id = ${gid} AND user_id = ${user.id}`;
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'leave') {
    if (m.role === 'owner') {
      const others = await q`SELECT 1 FROM group_members WHERE group_id = ${gid} AND user_id <> ${user.id} AND status = 'active'`;
      if (others.length) return bad('Jako właściciel nie możesz opuścić grupy z członkami. Przekaż własność innemu członkowi, usuń grupę albo usuń członków.');
      await q`DELETE FROM groups WHERE id = ${gid}`;
    } else await q`DELETE FROM group_members WHERE group_id = ${gid} AND user_id = ${user.id}`;
    return NextResponse.json({ ok: true });
  }
  if (m.status !== 'active') return bad('Najpierw zaakceptuj zaproszenie.', 403);

  if (b.action === 'invite') {
    const [t] = await q`SELECT id FROM users WHERE lower(username) = lower(${String(b.username ?? '').trim()})`;
    if (!t) return bad('Nie znaleziono takiego użytkownika.', 404);
    const blk = await q`SELECT 1 FROM blocks WHERE (blocker = ${user.id} AND blocked = ${t.id}) OR (blocker = ${t.id} AND blocked = ${user.id})`;
    if (blk.length) return bad('Nie można zaprosić tego użytkownika.', 403);
    const friend = await q`SELECT 1 FROM friendships WHERE status = 'accepted'
      AND ((requester = ${user.id} AND addressee = ${t.id}) OR (requester = ${t.id} AND addressee = ${user.id}))`;
    if (!friend.length && t.id !== user.id) return bad('Do grupy możesz zapraszać tylko znajomych.', 403);
    await q`INSERT INTO group_members (group_id, user_id, role, status) VALUES (${gid}, ${t.id}, 'member', 'invited') ON CONFLICT DO NOTHING`;
    return NextResponse.json({ ok: true });
  }
  const staff = m.role === 'owner' || m.role === 'moderator';
  if (b.action === 'kick') {
    if (!staff) return bad('Tylko właściciel albo moderator grupy może to zrobić.', 403);
    const uid = intId(b.userId);
    if (!uid) return bad('Błędny identyfikator.');
    if (uid === user.id) return bad('Nie możesz usunąć samego siebie.');
    // właściciel usuwa każdego poza sobą, moderator tylko zwykłych członków (nie właściciela i nie innych moderatorów)
    const del = await q`DELETE FROM group_members t WHERE t.group_id = ${gid}::int AND t.user_id = ${uid}::int AND t.role <> 'owner'
      AND EXISTS (SELECT 1 FROM group_members c WHERE c.group_id = ${gid}::int AND c.user_id = ${user.id}::int AND c.status = 'active'
                  AND (c.role = 'owner' OR (c.role = 'moderator' AND t.role = 'member')))
      RETURNING t.user_id`;
    if (!del.length) {
      const [t] = await q`SELECT 1 AS x FROM group_members WHERE group_id = ${gid}::int AND user_id = ${uid}::int`;
      return t ? bad('Nie możesz usunąć tego członka.', 403) : bad('Nie znaleziono członka grupy.', 404);
    }
    return NextResponse.json({ ok: true });
  }
  if (m.role !== 'owner') return bad('Tylko właściciel grupy może to zrobić.', 403);
  if (b.action === 'mod' || b.action === 'unmod') {
    const uid = intId(b.userId);
    if (!uid) return bad('Błędny identyfikator.');
    if (uid === user.id) return bad('Nie możesz zmienić własnej roli.');
    const on = b.action === 'mod';
    const upd = await q`UPDATE group_members t SET role = ${on ? 'moderator' : 'member'}::text
      WHERE t.group_id = ${gid}::int AND t.user_id = ${uid}::int AND t.status = 'active' AND t.role = ${on ? 'member' : 'moderator'}::text
        AND EXISTS (SELECT 1 FROM group_members c WHERE c.group_id = ${gid}::int AND c.user_id = ${user.id}::int AND c.status = 'active' AND c.role = 'owner')
      RETURNING t.user_id`;
    return upd.length ? NextResponse.json({ ok: true }) : bad(on ? 'Nie znaleziono członka, któremu można nadać rolę.' : 'Ten członek nie jest moderatorem.', 404);
  }
  if (b.action === 'transfer') {
    // właściciel i przejmujący zmieniają role w jednym zapytaniu razem z groups.owner_id; przejmujący podlega limitowi 10 grup
    const uid = intId(b.userId);
    if (!uid) return bad('Błędny identyfikator.');
    if (uid === user.id) return bad('Ta grupa już należy do Ciebie.');
    const [tgt] = await q`SELECT (SELECT count(*)::int FROM groups WHERE owner_id = ${uid}::int) AS owned FROM group_members
      WHERE group_id = ${gid}::int AND user_id = ${uid}::int AND status = 'active' AND role <> 'owner'`;
    if (!tgt) return bad('Nie znaleziono członka, któremu można przekazać grupę.', 404);
    if (tgt.owned >= 10) return bad('Ten członek jest już właścicielem maksymalnej liczby grup (10).');
    const [r] = await q`WITH me AS (
        SELECT 1 FROM group_members WHERE group_id = ${gid}::int AND user_id = ${user.id}::int AND status = 'active' AND role = 'owner' FOR UPDATE
      ), t AS (
        SELECT 1 FROM group_members WHERE group_id = ${gid}::int AND user_id = ${uid}::int AND status = 'active' AND role <> 'owner' FOR UPDATE
      ), upd AS (
        UPDATE group_members SET role = CASE WHEN user_id = ${uid}::int THEN 'owner' ELSE 'member' END
        WHERE group_id = ${gid}::int AND user_id IN (${user.id}::int, ${uid}::int) AND EXISTS (SELECT 1 FROM me) AND EXISTS (SELECT 1 FROM t)
        RETURNING user_id
      ), g AS (
        UPDATE groups SET owner_id = ${uid}::int WHERE id = ${gid}::int AND (SELECT count(*) FROM upd) = 2 RETURNING id
      )
      SELECT (SELECT count(*)::int FROM upd) AS n, (SELECT count(*)::int FROM g) AS g`;
    return r.n === 2 && r.g === 1 ? NextResponse.json({ ok: true }) : bad('Nie udało się przekazać grupy. Spróbuj ponownie.', 409);
  }
  if (b.action === 'delete') {
    await q`DELETE FROM groups WHERE id = ${gid}`;
    return NextResponse.json({ ok: true });
  }
  return bad('Nieznana akcja.');
});
