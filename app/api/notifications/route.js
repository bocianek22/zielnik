import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';

// Liczniki do menu: zaproszenia do znajomych, zaproszenia do grup, otwarte zgłoszenia (admin)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const q = sql();
  const [f] = await q`SELECT count(*)::int AS n FROM friendships WHERE addressee = ${user.id} AND status = 'pending'`;
  const [g] = await q`SELECT count(*)::int AS n FROM group_members WHERE user_id = ${user.id} AND status = 'invited'`;
  let admin = 0;
  if (user.is_admin) admin = (await q`SELECT count(*)::int AS n FROM reports WHERE status = 'open'`)[0].n;
  return NextResponse.json({ friends: f.n, groups: g.n, admin });
});
