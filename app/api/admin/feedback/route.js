import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, bad, safe, intId } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { STATUSES, NOTE_MAX } from '@/lib/feedback';

const list = () => sql()`
  SELECT f.id, f.kind, f.body, f.meta, f.status, f.admin_note AS note, u.username,
         to_char(f.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
  FROM beta_feedback f JOIN users u ON u.id = f.user_id
  ORDER BY (f.status = 'zrobione'), f.created_at DESC, f.id DESC LIMIT 200`;

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ items: await list() });
});

// { id, status?, note? } - zmiana statusu i/lub notatki (notatki nie widzi autor)
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const id = intId(b.id);
  if (!id) return bad('Nieprawidłowe zgłoszenie.');
  if (b.status !== undefined && !STATUSES.includes(b.status)) return bad('Nieznany status.');
  const note = b.note === undefined ? null : String(b.note).trim().slice(0, NOTE_MAX);
  const [r] = await sql()`UPDATE beta_feedback SET status = COALESCE(${b.status ?? null}, status), admin_note = COALESCE(${note}, admin_note)
                          WHERE id = ${id} RETURNING id`;
  if (!r) return bad('Nie znaleziono zgłoszenia.', 404);
  await logAudit(user.username, b.status ? `zmienił status zgłoszenia testera na „${b.status}”` : 'zapisał notatkę do zgłoszenia testera', String(id));
  return NextResponse.json({ items: await list() });
});
