import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { listMeasures, measureValues, measureDay, createMeasure } from '@/lib/measures';

// Własne pomiary (POM-63): definicje i wartości z ostatnich 30 dni; ?day=RRRR-MM-DD: tylko wartości z tego dnia
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const day = req ? new URL(req.url).searchParams.get('day') : null;
  if (day) return NextResponse.json({ day: await measureDay(user.id, day) });
  const [defs, values] = await Promise.all([listMeasures(user.id), measureValues(user.id)]);
  return NextResponse.json({ defs, values });
});

// { name, unit } - nowy pomiar (najwyżej 3 na konto)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`measures:${user.id}`, 120, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const out = await createMeasure(user.id, await jsonBody(req));
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ def: out.def, defs: await listMeasures(user.id) });
});
