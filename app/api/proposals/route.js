import { NextResponse } from 'next/server';
import { requireUser, safe } from '@/lib/guard';
import { listMine } from '@/lib/proposals';

// Własne propozycje zmian odmian (cudzych nie widać)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ proposals: await listMine(user.id) });
});
