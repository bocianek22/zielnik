import { NextResponse } from 'next/server';
import { requireUser, bad, safe } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { addNote, listNotes } from '@/lib/doctor-notes';

// POM-36: punkty „Do omówienia z lekarzem” (prywatne)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ notes: await listNotes(user.id) });
});

export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  // dodawanie i usuwanie w pętli omija limit liczby punktów (10 otwartych), więc osobny limit zapisów
  if (!(await hit(`doctor-note:${user.id}`, 60, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const b = await req.json().catch(() => ({}));
  const r = await addNote(user.id, b.text);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ notes: await listNotes(user.id) });
});
