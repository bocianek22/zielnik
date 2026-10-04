import { NextResponse } from 'next/server';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { listCustom, updateCustom, deleteCustom } from '@/lib/symptoms-custom';

// { name?, higherBetter? } - zmiana nazwy lub kierunku skali własnego objawu
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id) return bad('Nieprawidłowy objaw.');
  const b = await req.json().catch(() => ({}));
  const out = await updateCustom(user.id, id, b);
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ def: out.def, custom: await listCustom(user.id) });
});

// Usuwa własny objaw razem z jego wpisami
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!id) return bad('Nieprawidłowy objaw.');
  const removed = await deleteCustom(user.id, id);
  if (removed == null) return bad('Nie znaleziono objawu.', 404);
  return NextResponse.json({ removed, custom: await listCustom(user.id) });
});
