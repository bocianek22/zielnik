import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { listVisits, addVisit } from '@/lib/visits';
import { savePrefs } from '@/lib/push';
import { isIsoDay } from '@/lib/date';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ visits: await listVisits(user.id) });
});

// { day, note, nextVisit? } - nowa wizyta; nextVisit (RRRR-MM-DD) ustawia też datę następnej wizyty w przypomnieniach
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`visit-new:${user.id}`, 60, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const b = await jsonBody(req);
  const out = await addVisit(user.id, b);
  if (out.error) return bad(out.error, out.status);
  const next = String(b.nextVisit ?? '');
  if (next && isIsoDay(next) && next > out.visit.day) await savePrefs(user.id, { rx: null, stock: null, days: null, hour: null, details: null, visitSet: true, visitDate: next });
  return NextResponse.json({ visit: out.visit, visits: await listVisits(user.id) });
});
