import { NextResponse } from 'next/server';
import { requireUser, safe } from '@/lib/guard';
import { closeOnboarding } from '@/lib/onboarding';

// Zamknięcie lub pominięcie kreatora pierwszego uruchomienia (zapamiętane na koncie, nie na urządzeniu)
export const POST = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  await closeOnboarding(user.id);
  return NextResponse.json({ ok: true });
});
