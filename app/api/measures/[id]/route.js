import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { listMeasures, measureValues, updateMeasure, deleteMeasure } from '@/lib/measures';

// { name?, unit? } - zmiana nazwy lub jednostki pomiaru
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id) return bad('Nie znaleziono pomiaru.', 404);
  if (!(await hit(`measures:${user.id}`, 120, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const out = await updateMeasure(user.id, id, await jsonBody(req));
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ def: out.def, defs: await listMeasures(user.id) });
});

// Usuwa pomiar razem z jego wartościami
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const removed = id ? await deleteMeasure(user.id, id) : null;
  if (removed == null) return bad('Nie znaleziono pomiaru.', 404);
  const [defs, values] = await Promise.all([listMeasures(user.id), measureValues(user.id)]);
  return NextResponse.json({ removed, defs, values });
});
