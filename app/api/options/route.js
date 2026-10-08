import { NextResponse } from 'next/server';
import { hit } from '@/lib/ratelimit';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { canonOption, listOptions } from '@/lib/strains';

// Dopisanie nowej opcji do listy producentów lub typów
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { kind, value } = await jsonBody(req);
  if (!['producer', 'type', 'terpene'].includes(kind)) return bad('Nieznany rodzaj listy.');
  // listy są wspólne dla wszystkich: limit dopisywania nowych opcji na konto
  if (!(await hit(`option-new:${user.id}`, 30, 3600))) return bad('Zbyt wiele nowych opcji. Spróbuj ponownie za godzinę.', 429);
  const saved = await canonOption(kind, value);
  if (!saved) return bad('Wpisz nazwę nowej opcji.');
  return NextResponse.json({ value: saved, options: await listOptions() });
});
