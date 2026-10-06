import { NextResponse } from 'next/server';
import { requireUser, safe } from '@/lib/guard';
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
  const b = await req.json().catch(() => ({}));
  const r = await addNote(user.id, b.text);
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ notes: await listNotes(user.id) });
});
