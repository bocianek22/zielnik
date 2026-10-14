import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody, intId } from '@/lib/guard';
import { listFactors, renameFactor, deleteFactor } from '@/lib/factors';

// { name } - zmiana nazwy (znaczniki zostają)
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id) return bad('Nie znaleziono czynnika.', 404);
  const out = await renameFactor(user.id, id, await jsonBody(req));
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ def: out.def, factors: await listFactors(user.id) });
});

// usuwa czynnik razem z jego znacznikami
export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id || !(await deleteFactor(user.id, id))) return bad('Nie znaleziono czynnika.', 404);
  return NextResponse.json({ factors: await listFactors(user.id) });
});
