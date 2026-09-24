import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

// { action: 'block' | 'unblock', userId } - blokada usuwa też znajomość
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { action, userId } = await req.json().catch(() => ({}));
  const other = Number(userId);
  if (!Number.isInteger(other) || other === user.id) return bad('Nieprawidłowy użytkownik.');
  const q = sql();
  if (action === 'block') {
    await q`INSERT INTO blocks (blocker, blocked) VALUES (${user.id}, ${other}) ON CONFLICT DO NOTHING`;
    await q`DELETE FROM friendships WHERE (requester = ${user.id} AND addressee = ${other}) OR (requester = ${other} AND addressee = ${user.id})`;
  } else if (action === 'unblock') {
    await q`DELETE FROM blocks WHERE blocker = ${user.id} AND blocked = ${other}`;
  } else return bad('Nieznana akcja.');
  return NextResponse.json({ ok: true });
});
