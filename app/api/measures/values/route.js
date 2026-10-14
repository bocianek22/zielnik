import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { measureValues, saveMeasureDay } from '@/lib/measures';

// { day, values: { [id]: '72,5' | '' } } - wartości pomiarów z jednego dnia (pusta usuwa)
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`measures:${user.id}`, 120, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const out = await saveMeasureDay(user.id, await jsonBody(req));
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ values: await measureValues(user.id) });
});
