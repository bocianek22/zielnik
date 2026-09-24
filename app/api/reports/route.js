import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

const REASONS = { spam: 'Spam', ad: 'Reklama lub sprzedaż', abuse: 'Nękanie lub wyzwiska', privacy: 'Naruszenie prywatności', other: 'Inne' };

// { type: 'user' | 'test', userId, ref?, reason, note? }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const target = Number(b.userId);
  if (!['user', 'test'].includes(b.type) || !Number.isInteger(target) || target === user.id) return bad('Nieprawidłowe zgłoszenie.');
  if (!Object.keys(REASONS).includes(b.reason)) return bad('Wybierz powód zgłoszenia.');
  const ref = b.type === 'test' ? Number(b.ref) || null : null;
  const dup = await sql()`SELECT 1 FROM reports WHERE reporter_id = ${user.id} AND target_user_id = ${target} AND type = ${b.type}
                          AND ref IS NOT DISTINCT FROM ${ref}::int AND status = 'open'`;
  if (!dup.length) {
    await sql()`INSERT INTO reports (reporter_id, target_user_id, type, ref, reason, note)
                VALUES (${user.id}, ${target}, ${b.type}, ${ref}, ${b.reason}, ${String(b.note ?? '').trim().slice(0, 500)})`;
  }
  return NextResponse.json({ ok: true });
});
