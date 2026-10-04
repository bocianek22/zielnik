import { NextResponse } from 'next/server';
import { bad, cronAuthorized, safe } from '@/lib/guard';
import { saveSnapshot } from '@/lib/backup';

// Cotygodniowa automatyczna migawka bazy (Vercel Cron, patrz vercel.json). Wymaga CRON_SECRET.
export const GET = safe(async (req) => {
  if (!cronAuthorized(req)) return bad('Brak autoryzacji.', 401);
  return NextResponse.json({ ok: true, size: await saveSnapshot('auto') });
});
