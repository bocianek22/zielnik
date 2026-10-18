import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { deleteMed, listMeds } from '@/lib/other-meds';

// Usunięcie własnego leku z listy; cudzy lub nieistniejący: 404
export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id || !(await deleteMed(user.id, id))) return bad('Nie znaleziono leku.', 404);
  return NextResponse.json({ meds: await listMeds(user.id) });
});
