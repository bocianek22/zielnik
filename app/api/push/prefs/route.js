import { NextResponse } from 'next/server';
import { bad, requireUser, safe } from '@/lib/guard';
import { parsePrefs, savePrefs } from '@/lib/push';

// Rodzaje przypomnień, próg zapasu (dni), godzina wysyłki i szczegóły w treści; pominięte pola bez zmian
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const p = parsePrefs(await req.json().catch(() => ({})));
  if (p.error) return bad(p.error);
  return NextResponse.json({ ok: true, prefs: await savePrefs(user.id, p.prefs) });
});
