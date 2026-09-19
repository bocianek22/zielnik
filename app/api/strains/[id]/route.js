import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseCommon } from '@/lib/strains';

// Edycja pól wspólnych (dostępna dla każdego zalogowanego)
export const PATCH = safe(async (req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const { error, fields: f } = await parseCommon(await req.json().catch(() => ({})));
  if (error) return bad(error);
  const rows = await sql()`UPDATE strains SET producer = ${f.producer}, name = ${f.name}, type = ${f.type},
                             final_rating = ${f.finalRating}, taste = ${f.taste}
                           WHERE id = ${id} RETURNING id`;
  if (!rows.length) return bad('Nie znaleziono odmiany.', 404);
  return NextResponse.json({ ok: true });
});

// Usunięcie: twórca odmiany lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const found = await sql()`SELECT created_by FROM strains WHERE id = ${id}`;
  if (!found.length) return bad('Nie znaleziono odmiany.', 404);
  if (!user.is_admin && found[0].created_by !== user.id) {
    return bad('Odmianę może usunąć jej twórca lub admin.', 403);
  }
  await sql()`DELETE FROM strains WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
});
