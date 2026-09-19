import { NextResponse } from 'next/server';
import { requireUser, bad, safe } from '@/lib/guard';
import { canonOption, listOptions } from '@/lib/strains';

// Dopisanie nowej opcji do listy producentów lub typów
export const POST = safe(async (req) => {
  const { res } = await requireUser();
  if (res) return res;
  const { kind, value } = await req.json().catch(() => ({}));
  if (!['producer', 'type'].includes(kind)) return bad('Nieznany rodzaj listy.');
  const saved = await canonOption(kind, value);
  if (!saved) return bad('Wpisz nazwę nowej opcji.');
  return NextResponse.json({ value: saved, options: await listOptions() });
});
