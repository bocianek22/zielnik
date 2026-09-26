import { NextResponse } from 'next/server';
import { bad, safe } from '@/lib/guard';
import { saveSnapshot } from '@/lib/backup';

// Cotygodniowa automatyczna migawka bazy (Vercel Cron, patrz vercel.json). Wymaga CRON_SECRET.
export const GET = safe(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return bad('Brak autoryzacji.', 401);
  return NextResponse.json({ ok: true, size: await saveSnapshot('auto') });
});
