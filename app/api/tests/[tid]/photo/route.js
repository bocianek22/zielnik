import { sql } from '@/lib/db';
import { requireUser, safe, intId } from '@/lib/guard';
import { photoResponse } from '@/lib/photos';

export const GET = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const rows = await sql()`SELECT mime, data, blob_path FROM strain_tests WHERE id = ${intId((await params).tid)} AND data IS NOT NULL AND can_see(${user.id}::int, user_id, visibility)`;
  if (!rows.length) return new Response('Brak zdjęcia', { status: 404 });
  return photoResponse(rows[0]);
});
