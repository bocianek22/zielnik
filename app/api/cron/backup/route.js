import { NextResponse } from 'next/server';
import { bad, cronAuthorized, safe } from '@/lib/guard';
import { markCron } from '@/lib/readiness';
import { saveSnapshot } from '@/lib/backup';

// Codzienna automatyczna migawka bazy (Vercel Cron, patrz vercel.json). Wymaga CRON_SECRET.
export const GET = safe(async (req) => {
  if (!cronAuthorized(req)) return bad('Brak autoryzacji.', 401);
  const size = await saveSnapshot('auto');
  await markCron('backup');
  return NextResponse.json({ ok: true, size });
});
