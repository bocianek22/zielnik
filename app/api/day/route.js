import { NextResponse } from 'next/server';
import { requireUser, bad, safe } from '@/lib/guard';
import { dayCard, DAY_RE } from '@/lib/day-card';
import { todayPL, addDaysIso } from '@/lib/date';

// GET /api/day?d=RRRR-MM-DD: karta dnia (lib/day-card.js), tylko własne dane, dzień z ostatnich 2 lat do dziś
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const d = new URL(req.url).searchParams.get('d') || '';
  const today = todayPL();
  if (!DAY_RE.test(d) || Number.isNaN(Date.parse(d)) || d > today || d < addDaysIso(today, -731)) return bad('Nieprawidłowy dzień.');
  return NextResponse.json(await dayCard(user.id, d));
});
