import { NextResponse } from 'next/server';
import { bad, cronAuthorized, safe } from '@/lib/guard';
import { markCron } from '@/lib/readiness';
import { NOT_CONFIGURED, pushConfig, sendReminders } from '@/lib/push';

export const maxDuration = 60;

// Codzienne przypomnienia push (Vercel Cron, patrz vercel.json). Wymaga CRON_SECRET.
export const GET = safe(async (req) => {
  if (!cronAuthorized(req)) return bad('Brak autoryzacji.', 401);
  if (!pushConfig().any) { await markCron('reminders'); return NextResponse.json({ ok: true, skipped: NOT_CONFIGURED }); }
  const stats = await sendReminders();
  await markCron('reminders'); // znacznik dla panelu „Gotowość”
  return NextResponse.json({ ok: true, ...stats });
});
