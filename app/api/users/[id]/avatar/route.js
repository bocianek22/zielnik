import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';

export const GET = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const rows = await sql()`SELECT avatar, can_see(${user.id}::int, id, profile_visibility) AS ok FROM users WHERE id = ${Number((await params).id)}`;
  const m = rows[0]?.ok && /^data:(image\/[a-z]+);base64,(.+)$/.exec(rows[0].avatar || '');
  if (!m) return new Response('Brak', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), { headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=300' } });
});
