import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseCommon, updateStrain } from '@/lib/strains';

// Edycja pól wspólnych (dostępna dla każdego zalogowanego)
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const { error, fields: f } = await parseCommon(await req.json().catch(() => ({})));
  if (error) return bad(error);
  const row = await updateStrain(id, f, user.id);
  if (!row) return bad('Nie znaleziono odmiany.', 404);
  return NextResponse.json({ ok: true });
});

// Usunięcie: twórca odmiany lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const found = await sql()`SELECT created_by FROM strains WHERE id = ${id}`;
  if (!found.length) return bad('Nie znaleziono odmiany.', 404);
  if (!user.is_admin && found[0].created_by !== user.id) {
    return bad('Odmianę może usunąć jej twórca lub admin.', 403);
  }
  if (user.is_admin) {
    await sql()`DELETE FROM strains WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  // usunięcie kasuje kaskadowo oceny, testy i dziennik zużycia wszystkich osób, więc twórca może usunąć
  // tylko odmianę, której nikt inny jeszcze nie używa; sprawdzenie i usunięcie w jednym zapytaniu
  const del = await sql()`DELETE FROM strains WHERE id = ${id} AND NOT (
      EXISTS (SELECT 1 FROM user_strain WHERE strain_id = ${id} AND user_id <> ${user.id}
              AND (rating IS NOT NULL OR notes <> '' OR effects <> '{}'::jsonb OR current_amount > 0)) OR
      EXISTS (SELECT 1 FROM usage_log WHERE strain_id = ${id} AND user_id <> ${user.id}) OR
      EXISTS (SELECT 1 FROM purchases WHERE strain_id = ${id} AND user_id <> ${user.id}) OR
      EXISTS (SELECT 1 FROM user_pool WHERE pool_key = 'strain:' || ${id}::int AND user_id <> ${user.id} AND remaining_to_buy > 0) OR
      EXISTS (SELECT 1 FROM strain_tests WHERE strain_id = ${id} AND user_id IS DISTINCT FROM ${user.id})
    ) RETURNING id`;
  if (!del.length) return bad('Tej odmiany używają już inne osoby (oceny, zakupy, zużycie lub testy). Usunąć ją może tylko admin.', 409);
  return NextResponse.json({ ok: true });
});
