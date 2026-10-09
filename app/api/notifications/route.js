import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';

// Liczniki do menu: zaproszenia do znajomych, grupy (zaproszenia + nieprzeczytane wiadomości czatu, do 99), otwarte zgłoszenia (admin)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const q = sql();
  const [f] = await q`SELECT count(*)::int AS n FROM friendships WHERE addressee = ${user.id} AND status = 'pending'`;
  const [g] = await q`SELECT count(*)::int AS n FROM group_members WHERE user_id = ${user.id} AND status = 'invited'`;
  // nieprzeczytane cudze wiadomości w grupach, w których jestem aktywnym członkiem (do 100 na grupę, po indeksie (group_id, id))
  const [c] = await q`SELECT COALESCE(sum(n), 0)::int AS n FROM (
    SELECT (SELECT count(*) FROM (SELECT 1 FROM group_messages m WHERE m.group_id = gm.group_id AND m.id > gm.last_read_message_id
              AND m.user_id <> ${user.id}::int AND m.deleted_at IS NULL AND can_see(${user.id}::int, m.user_id, 'all') LIMIT 100) x) AS n
    FROM group_members gm WHERE gm.user_id = ${user.id}::int AND gm.status = 'active') t`;
  const chat = Math.min(c.n, 99);
  let admin = 0;
  if (user.is_admin) admin = (await q`SELECT count(*)::int AS n FROM reports WHERE status = 'open'`)[0].n;
  return NextResponse.json({ friends: f.n, groups: g.n + chat, chat, admin });
});
