import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';

// { upTo? } - oznacza wiadomości do id upTo (domyślnie wszystkie) jako przeczytane; znacznik tylko rośnie
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const gid = intId((await params).id);
  const upTo = intId((await jsonBody(req)).upTo) || 2147483647;
  const r = gid && await sql()`UPDATE group_members SET last_read_message_id = GREATEST(last_read_message_id,
      LEAST(${upTo}::int, (SELECT COALESCE(max(id), 0) FROM group_messages WHERE group_id = ${gid}::int)))
    WHERE group_id = ${gid}::int AND user_id = ${user.id}::int AND status = 'active' RETURNING 1 AS ok`;
  if (!r?.length) return bad('Nie znaleziono grupy.', 404);
  return NextResponse.json({ ok: true });
});
