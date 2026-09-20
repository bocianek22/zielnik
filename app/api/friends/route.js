import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

const list = (me) => sql()`
  SELECT u.id, u.username, u.display_name, f.status, (f.requester = ${me}::int) AS outgoing
  FROM friendships f JOIN users u ON u.id = CASE WHEN f.requester = ${me}::int THEN f.addressee ELSE f.requester END
  WHERE f.requester = ${me}::int OR f.addressee = ${me}::int ORDER BY lower(u.username)`;

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ friends: await list(user.id) });
});

// { action: 'request' | 'accept' | 'remove', userId }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { action, userId } = await req.json().catch(() => ({}));
  const other = Number(userId);
  if (!Number.isInteger(other) || other === user.id) return bad('Nieprawidłowy użytkownik.');
  const exists = await sql()`SELECT 1 FROM users WHERE id = ${other}`;
  if (!exists.length) return bad('Nie znaleziono użytkownika.', 404);

  if (action === 'request') {
    const cur = await sql()`SELECT requester, status FROM friendships
                            WHERE (requester = ${user.id} AND addressee = ${other}) OR (requester = ${other} AND addressee = ${user.id})`;
    if (!cur.length) await sql()`INSERT INTO friendships (requester, addressee) VALUES (${user.id}, ${other})`;
    else if (cur[0].status === 'pending' && cur[0].requester === other) {
      await sql()`UPDATE friendships SET status = 'accepted' WHERE requester = ${other} AND addressee = ${user.id}`;
    }
  } else if (action === 'accept') {
    await sql()`UPDATE friendships SET status = 'accepted' WHERE requester = ${other} AND addressee = ${user.id} AND status = 'pending'`;
  } else if (action === 'remove') {
    await sql()`DELETE FROM friendships WHERE (requester = ${user.id} AND addressee = ${other}) OR (requester = ${other} AND addressee = ${user.id})`;
  } else return bad('Nieznana akcja.');
  return NextResponse.json({ friends: await list(user.id) });
});
