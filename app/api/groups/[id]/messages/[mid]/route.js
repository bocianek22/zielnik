import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { logAudit } from '@/lib/audit';
import { activeMember, cleanBody, fetchMessages, toClient, sealBody, BAD_BODY_MSG, NOT_FOUND_MSG, NOTE_UNAVAILABLE_REJECT_MSG, EDIT_MINUTES } from '@/lib/chat';

const NO_MSG = 'Nie znaleziono wiadomości.';

// { body } - edycja własnej wiadomości do 15 minut od wysłania
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const p = await params;
  const gid = intId(p.id), mid = intId(p.mid);
  const m = gid && mid && await activeMember(gid, user.id);
  if (!m) return bad(NOT_FOUND_MSG, 404);
  const text = cleanBody((await jsonBody(req)).body);
  if (!text) return bad(BAD_BODY_MSG);
  if (!(await hit(`chat-edit:${user.id}`, 30, 60))) return bad('Zbyt wiele zmian. Spróbuj ponownie za chwilę.', 429);
  const stored = sealBody(mid, text);
  if (stored == null) return bad(NOTE_UNAVAILABLE_REJECT_MSG, 422);
  const upd = await sql()`UPDATE group_messages SET body = ${stored}::text, edited_at = now()
    WHERE id = ${mid}::int AND group_id = ${gid}::int AND user_id = ${user.id}::int AND deleted_at IS NULL
      AND created_at > now() - make_interval(mins => ${EDIT_MINUTES}::int)
      AND EXISTS (SELECT 1 FROM group_members WHERE group_id = ${gid}::int AND user_id = ${user.id}::int AND status = 'active')
    RETURNING id`;
  if (!upd.length) {
    // dlaczego nie: cudza albo usunięta = 404, własna po terminie = 403
    const [o] = await sql()`SELECT 1 AS x FROM group_messages WHERE id = ${mid}::int AND group_id = ${gid}::int AND user_id = ${user.id}::int AND deleted_at IS NULL`;
    return o ? bad(`Wiadomość można edytować do ${EDIT_MINUTES} minut od wysłania.`, 403) : bad(NO_MSG, 404);
  }
  const [row] = await fetchMessages(gid, user.id, 'm.id = $3::int', [mid], '');
  return NextResponse.json({ message: toClient(row, user.id, m.role, user.is_admin) });
});

// Miękkie usunięcie (treść znika z bazy): autor, właściciel grupy, moderator (SPO-3) albo admin aplikacji (także niebędący członkiem grupy)
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const p = await params;
  const gid = intId(p.id), mid = intId(p.mid);
  if (!gid || !mid) return bad(NO_MSG, 404);
  const m = await activeMember(gid, user.id);
  if (!m && !user.is_admin) return bad(NOT_FOUND_MSG, 404);
  const del = await sql()`UPDATE group_messages SET body = '', deleted_at = now(), deleted_by = ${user.id}::int
    WHERE id = ${mid}::int AND group_id = ${gid}::int AND deleted_at IS NULL AND (
      ${!!user.is_admin}::boolean
      OR EXISTS (SELECT 1 FROM group_members g WHERE g.group_id = ${gid}::int AND g.user_id = ${user.id}::int AND g.status = 'active'
                 AND (g.role = 'owner' OR group_messages.user_id = ${user.id}::int
                      OR (g.role = 'moderator' AND NOT EXISTS (SELECT 1 FROM group_members a WHERE a.group_id = ${gid}::int
                          AND a.user_id = group_messages.user_id AND a.role IN ('owner', 'moderator'))))))
    RETURNING id`;
  if (!del.length) {
    // członek, który nie może usunąć istniejącej wiadomości, dostaje 403; brak albo już usunięta = 404
    const [ex] = m ? await sql()`SELECT 1 AS x FROM group_messages WHERE id = ${mid}::int AND group_id = ${gid}::int AND deleted_at IS NULL` : [];
    return ex ? bad('Nie możesz usunąć tej wiadomości.', 403) : bad(NO_MSG, 404);
  }
  if (user.is_admin && !m) await logAudit(user.id, 'chat.delete', mid, { group: gid });
  return NextResponse.json({ ok: true });
});
