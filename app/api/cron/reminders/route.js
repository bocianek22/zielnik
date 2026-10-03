import { NextResponse } from 'next/server';
import { bad, safe } from '@/lib/guard';
import { NOT_CONFIGURED, pushConfig, sendReminders } from '@/lib/push';

export const maxDuration = 60;

// Codzienne przypomnienia push (Vercel Cron, patrz vercel.json). Wymaga CRON_SECRET.
export const GET = safe(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return bad('Brak autoryzacji.', 401);
  if (!pushConfig().any) return NextResponse.json({ ok: true, skipped: NOT_CONFIGURED });
  return NextResponse.json({ ok: true, ...(await sendReminders()) });
});
