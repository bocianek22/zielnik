import { sql } from '@/lib/db';
import { requireUser, safe } from '@/lib/guard';

export const GET = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const rows = await sql()`SELECT mime, data FROM strain_tests WHERE id = ${Number((await params).tid)} AND data IS NOT NULL AND can_see(${user.id}::int, user_id, visibility)`;
  if (!rows.length) return new Response('Brak zdjęcia', { status: 404 });
  return new Response(Buffer.from(rows[0].data, 'base64'), {
    headers: { 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
});
