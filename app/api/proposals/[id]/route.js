import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { withdraw } from '@/lib/proposals';

// Wycofanie własnej, jeszcze nierozpatrzonej propozycji
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await withdraw(intId((await params).id), user.id))) return bad('Nie znaleziono oczekującej propozycji.', 404);
  return NextResponse.json({ ok: true });
});
