import { NextResponse } from 'next/server';
import { requireUser, safe, jsonBody } from '@/lib/guard';
import { todayLayout, setTodayLayout } from '@/lib/today-layout';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { hidden, order } = await todayLayout(user.id);
  return NextResponse.json({ hidden, order });
});

// { hidden?: ['chart', ...], order?: ['plan', 'tiles', ...] } - układ panelu „Dziś” (nieznane klucze są pomijane)
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req);
  const { hidden, order } = await setTodayLayout(user.id, { hidden: b.hidden, order: b.order });
  return NextResponse.json({ hidden, order });
});
