import { NextResponse } from 'next/server';
import { requireUser, safe, jsonBody } from '@/lib/guard';
import { todayHidden, setTodayHidden } from '@/lib/today-layout';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ hidden: await todayHidden(user.id) });
});

// { hidden: ['chart', ...] } - ukryte karty panelu „Dziś” (nieznane klucze są pomijane)
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req);
  return NextResponse.json({ hidden: await setTodayHidden(user.id, b.hidden) });
});
