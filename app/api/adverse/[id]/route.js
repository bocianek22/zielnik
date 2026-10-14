import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { listAdverse, deleteAdverse } from '@/lib/adverse';

export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id || !(await deleteAdverse(user.id, id))) return bad('Nie znaleziono zdarzenia.', 404);
  return NextResponse.json({ events: await listAdverse(user.id) });
});
