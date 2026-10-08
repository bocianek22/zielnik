import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, bad, safe, intId } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { deletePhotos } from '@/lib/photos';
import { decryptField, rowScope } from '@/lib/data-crypto';

const list = async () => (await sql()`
  SELECT r.id, r.type, r.ref, r.reason, r.note, tu.username AS target, tu.id AS target_id, ru.username AS reporter,
         to_char(r.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
         (SELECT t.note FROM strain_tests t WHERE r.type = 'test' AND t.id = r.ref AND t.user_id = r.target_user_id) AS test_note
  FROM reports r JOIN users tu ON tu.id = r.target_user_id LEFT JOIN users ru ON ru.id = r.reporter_id
  WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 50`).map((r) => (r.test_note ? { ...r, test_note: decryptField('strain_tests', 'note', rowScope('strain_tests', { id: r.ref }), r.test_note) } : r));

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
  const [r] = await sql()`SELECT type, ref, target_user_id FROM reports WHERE id = ${intId(id)}`;
  if (!r) return bad('Nie znaleziono zgłoszenia.', 404);
  if (deleteContent && r.type === 'test' && r.ref) await deletePhotos((await sql()`DELETE FROM strain_tests WHERE id = ${r.ref} AND user_id = ${r.target_user_id} RETURNING blob_path`).map((x) => x.blob_path));
  await logAudit(user.username, deleteContent ? 'usunął zgłoszony test i zamknął zgłoszenie' : 'zamknął zgłoszenie', String(id));
  await sql()`UPDATE reports SET status = 'resolved' WHERE id = ${intId(id)}`;
  return NextResponse.json({ reports: await list() });
});
