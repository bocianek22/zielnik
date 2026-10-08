import { NextResponse } from 'next/server';
import { requireAdmin, safe } from '@/lib/guard';
import { readinessReport } from '@/lib/readiness';

// Gotowość konfiguracji (tylko admin): stan pozycji bez wartości zmiennych środowiskowych
export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json(await readinessReport());
});
