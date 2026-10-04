import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';

const REASONS = { spam: 'Spam', ad: 'Reklama lub sprzedaż', abuse: 'Nękanie lub wyzwiska', privacy: 'Naruszenie prywatności', other: 'Inne' };

// { type: 'user' | 'test', userId, ref?, reason, note? }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const target = intId(b.userId);
  if (!['user', 'test'].includes(b.type) || !target || target === user.id) return bad('Nieprawidłowe zgłoszenie.');
  if (!Object.keys(REASONS).includes(b.reason)) return bad('Wybierz powód zgłoszenia.');
  const ref = b.type === 'test' ? intId(b.ref) || null : null;
  if (b.type === 'test' && !ref) return bad('Nieprawidłowe zgłoszenie.');
  // Zgłoszony test musi należeć do zgłaszanej osoby i być widoczny dla zgłaszającego: inaczej dowolny numer testu
  // pokazałby adminowi cudzą prywatną notatkę, a „usuń treść” skasowałoby test kogoś innego.
  const [ok] = b.type === 'test'
    ? await sql()`SELECT 1 AS x FROM strain_tests WHERE id = ${ref} AND user_id = ${target} AND can_see(${user.id}::int, user_id, visibility)`
    : await sql()`SELECT 1 AS x FROM users WHERE id = ${target}`;
  if (!ok) return bad('Nie znaleziono zgłaszanej treści.', 404);
  if (!(await hit(`report:${user.id}`, 20, 3600))) return bad('Zbyt wiele zgłoszeń. Spróbuj ponownie później.', 429);
  const dup = await sql()`SELECT 1 FROM reports WHERE reporter_id = ${user.id} AND target_user_id = ${target} AND type = ${b.type}
                          AND ref IS NOT DISTINCT FROM ${ref}::int AND status = 'open'`;
  if (!dup.length) {
    await sql()`INSERT INTO reports (reporter_id, target_user_id, type, ref, reason, note)
                VALUES (${user.id}, ${target}, ${b.type}, ${ref}, ${b.reason}, ${String(b.note ?? '').trim().slice(0, 500)})`;
  }
  return NextResponse.json({ ok: true });
});
