import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, bad, safe, intId, jsonBody } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { deletePhotos } from '@/lib/photos';
import { decryptField, rowScope } from '@/lib/data-crypto';

const list = async () => (await sql()`
  SELECT r.id, r.type, r.ref, r.reason, r.note, tu.username AS target, tu.id AS target_id, ru.username AS reporter,
         to_char(r.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
         (SELECT t.note FROM strain_tests t WHERE r.type = 'test' AND t.id = r.ref AND t.user_id = r.target_user_id) AS test_note,
         (SELECT s.producer || ' ' || s.name FROM strains s WHERE r.type IN ('strain', 'photo') AND s.id = r.ref) AS strain_name,
         (SELECT m.body FROM group_messages m WHERE r.type = 'message' AND m.id = r.ref AND m.user_id = r.target_user_id AND m.deleted_at IS NULL) AS message_body,
         (SELECT g.name FROM group_messages m JOIN groups g ON g.id = m.group_id WHERE r.type = 'message' AND m.id = r.ref) AS message_group,
         (r.type = 'message' AND EXISTS (SELECT 1 FROM group_messages m WHERE m.id = r.ref AND m.user_id = r.target_user_id AND m.deleted_at IS NULL)) AS message_exists,
         (r.type = 'photo' AND EXISTS (SELECT 1 FROM strain_photos p WHERE p.strain_id = r.ref)) AS photo_exists
  FROM reports r JOIN users tu ON tu.id = r.target_user_id LEFT JOIN users ru ON ru.id = r.reporter_id
  WHERE r.status = 'open' ORDER BY r.created_at DESC LIMIT 50`).map((r) => {
    const o = r.test_note ? { ...r, test_note: decryptField('strain_tests', 'note', rowScope('strain_tests', { id: r.ref }), r.test_note) } : r;
    return o.message_body ? { ...o, message_body: decryptField('group_messages', 'body', rowScope('group_messages', { id: r.ref }), o.message_body) } : o;
  });

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ reports: await list() });
});

// { id, deleteContent?: boolean } - zamyka zgłoszenie, opcjonalnie usuwa zgłoszony test, wiadomość z czatu grupy albo wspólne zdjęcie odmiany
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const { id, deleteContent } = await jsonBody(req);
  const [r] = await sql()`SELECT type, ref, target_user_id FROM reports WHERE id = ${intId(id)}`;
  if (!r) return bad('Nie znaleziono zgłoszenia.', 404);
  if (deleteContent && r.type === 'test' && r.ref) await deletePhotos((await sql()`DELETE FROM strain_tests WHERE id = ${r.ref} AND user_id = ${r.target_user_id} RETURNING blob_path`).map((x) => x.blob_path));
  if (deleteContent && r.type === 'message' && r.ref) await sql()`UPDATE group_messages SET body = '', deleted_at = now(), deleted_by = ${user.id}::int WHERE id = ${r.ref} AND user_id = ${r.target_user_id} AND deleted_at IS NULL`;
  if (deleteContent && r.type === 'photo' && r.ref) await deletePhotos((await sql()`DELETE FROM strain_photos WHERE strain_id = ${r.ref} RETURNING blob_path`).map((x) => x.blob_path));
  await logAudit(user.username, deleteContent ? (r.type === 'photo' ? 'usunął zgłoszone zdjęcie odmiany i zamknął zgłoszenie' : r.type === 'message' ? 'usunął zgłoszoną wiadomość z czatu grupy i zamknął zgłoszenie' : 'usunął zgłoszony test i zamknął zgłoszenie') : 'zamknął zgłoszenie', String(id));
  await sql()`UPDATE reports SET status = 'resolved' WHERE id = ${intId(id)}`;
  return NextResponse.json({ reports: await list() });
});
