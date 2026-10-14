import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { listVisits, deleteVisit } from '@/lib/visits';

export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id || !(await deleteVisit(user.id, id))) return bad('Nie znaleziono wizyty.', 404);
  return NextResponse.json({ visits: await listVisits(user.id) });
});
