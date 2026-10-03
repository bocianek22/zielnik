import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, bad, safe } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { deletePhotos } from '@/lib/photos';

const list = () => sql()`
  SELECT r.id, r.type, r.ref, r.reason, r.note, tu.username AS target, tu.id AS target_id, ru.username AS reporter,
         to_char(r.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
         (SELECT t.note FROM strain_tests t WHERE r.type = 'test' AND t.id = r.ref) AS test_note
  FROM reports r JOIN users tu ON tu.id = r.target_user_id LEFT JOIN users ru ON ru.id = r.reporter_id
  WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 50`;

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ reports: await list() });
});

// { id, deleteContent?: boolean } - zamyka zgłoszenie, opcjonalnie usuwa zgłoszony test
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const { id, deleteContent } = await req.json().catch(() => ({}));
  const [r] = await sql()`SELECT type, ref FROM reports WHERE id = ${Number(id)}`;
  if (!r) return bad('Nie znaleziono zgłoszenia.', 404);
  if (deleteContent && r.type === 'test' && r.ref) await deletePhotos((await sql()`DELETE FROM strain_tests WHERE id = ${r.ref} RETURNING blob_path`).map((x) => x.blob_path));
  await logAudit(user.username, deleteContent ? 'usunął zgłoszony test i zamknął zgłoszenie' : 'zamknął zgłoszenie', String(id));
  await sql()`UPDATE reports SET status = 'resolved' WHERE id = ${Number(id)}`;
  return NextResponse.json({ reports: await list() });
});
