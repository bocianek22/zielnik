import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { deleteNote, listNotes, setDone } from '@/lib/doctor-notes';

// Odhaczenie („omówione”) albo usunięcie własnego punktu; cudzy lub nieistniejący: 404
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const b = await req.json().catch(() => ({}));
  if (!id || typeof b.done !== 'boolean') return bad('Nieprawidłowe dane.');
  if (!(await setDone(user.id, id, b.done))) return bad('Nie znaleziono punktu.', 404);
  return NextResponse.json({ notes: await listNotes(user.id) });
});

export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id || !(await deleteNote(user.id, id))) return bad('Nie znaleziono punktu.', 404);
  return NextResponse.json({ notes: await listNotes(user.id) });
});
