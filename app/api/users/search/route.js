import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';

// Wyszukiwarka użytkowników po nazwie użytkownika lub nazwie wyświetlanej
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const q = (new URL(req.url).searchParams.get('q') || '').toLowerCase().replace(/[%_\\]/g, '').trim();
  if (q.length < 2) return NextResponse.json({ users: [] });
  const like = `%${q}%`;
  const users = await sql()`
    SELECT u.id, u.username, u.display_name,
      (SELECT f.status FROM friendships f WHERE (f.requester = ${user.id}::int AND f.addressee = u.id) OR (f.requester = u.id AND f.addressee = ${user.id}::int)) AS status,
      (SELECT f.requester = ${user.id}::int FROM friendships f WHERE (f.requester = ${user.id}::int AND f.addressee = u.id) OR (f.requester = u.id AND f.addressee = ${user.id}::int)) AS outgoing
    FROM users u WHERE u.id <> ${user.id}::int AND (lower(u.username) LIKE ${like} OR lower(u.display_name) LIKE ${like})
    ORDER BY lower(u.username) LIMIT 10`;
  return NextResponse.json({ users });
});
