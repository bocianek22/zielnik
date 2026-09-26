import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

// { action: 'invite' | 'accept' | 'leave' | 'kick' | 'delete', username?, userId? }
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const gid = Number((await params).id);
  const b = await req.json().catch(() => ({}));
  const q = sql();
  const [m] = await q`SELECT role, status FROM group_members WHERE group_id = ${gid} AND user_id = ${user.id}`;
  if (!m) return bad('Nie należysz do tej grupy.', 403);

  if (b.action === 'accept') {
    if (m.status !== 'invited') return bad('Brak zaproszenia.');
    await q`UPDATE group_members SET status = 'active' WHERE group_id = ${gid} AND user_id = ${user.id}`;
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'leave') {
    if (m.role === 'owner') {
      const others = await q`SELECT 1 FROM group_members WHERE group_id = ${gid} AND user_id <> ${user.id} AND status = 'active'`;
      if (others.length) return bad('Jako właściciel nie możesz opuścić grupy z członkami. Usuń grupę albo usuń członków.');
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
  if (m.role !== 'owner') return bad('Tylko właściciel grupy może to zrobić.', 403);
  if (b.action === 'kick') {
    const uid = Number(b.userId);
    if (uid === user.id) return bad('Nie możesz usunąć samego siebie.');
    await q`DELETE FROM group_members WHERE group_id = ${gid} AND user_id = ${uid}`;
    return NextResponse.json({ ok: true });
  }
  if (b.action === 'delete') {
    await q`DELETE FROM groups WHERE id = ${gid}`;
    return NextResponse.json({ ok: true });
  }
  return bad('Nieznana akcja.');
});
