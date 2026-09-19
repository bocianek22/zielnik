import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

// Usunięcie testu: autor lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const tid = Number((await params).tid);
  const rows = await sql()`SELECT user_id FROM strain_tests WHERE id = ${tid}`;
  if (!rows.length) return bad('Nie znaleziono testu.', 404);
  if (!user.is_admin && rows[0].user_id !== user.id) return bad('Test może usunąć jego autor lub admin.', 403);
  await sql()`DELETE FROM strain_tests WHERE id = ${tid}`;
  return NextResponse.json({ ok: true });
});
