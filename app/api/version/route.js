import { NextResponse } from 'next/server';
import { VERSION } from '@/lib/version';

// Publiczna informacja diagnostyczna: wersja aplikacji i skrót commita wdrożenia
export const dynamic = 'force-dynamic';
export const GET = () => NextResponse.json({
  version: VERSION,
  commit: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7) || null,
  environment: process.env.VERCEL_ENV || 'local',
});
