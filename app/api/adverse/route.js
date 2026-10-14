import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { listAdverse, addAdverse } from '@/lib/adverse';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ events: await listAdverse(user.id) });
});

// { day, severity, note } - nowe zdarzenie niepożądane (POM-62)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`adverse-new:${user.id}`, 60, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const out = await addAdverse(user.id, await jsonBody(req));
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ event: out.event, events: await listAdverse(user.id) });
});
