import { NextResponse } from 'next/server';
import { bad, requireUser, safe } from '@/lib/guard';
import { currentSessionId, destroySession, revokeSession } from '@/lib/auth';
import { hit } from '@/lib/ratelimit';

// Wylogowanie jednej sesji z listy urządzeń. Identyfikator sesji to tekst (nie liczba), więc zamiast intId()
// sprawdza go SID_RE w revokeSession; cudza, nieistniejąca lub już zakończona sesja = 404.
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`sessions:${user.id}`, 30, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const id = String((await params).id || '');
  const current = id === (await currentSessionId());
  if (!(await revokeSession(user.id, id))) return bad('Nie znaleziono sesji.', 404);
  if (current) await destroySession();
  return NextResponse.json({ ok: true, current });
});
