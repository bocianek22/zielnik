import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';

const TYPES = ['user', 'test', 'strain', 'photo'];
const REASONS = { spam: 'Spam', ad: 'Reklama lub sprzedaż', abuse: 'Nękanie lub wyzwiska', privacy: 'Naruszenie prywatności', other: 'Inne' };

// { type: 'user' | 'test' | 'strain' | 'photo', userId?, ref?, reason, note? }
// user: userId = zgłaszany profil; test: userId = autor testu, ref = id testu;
// strain / photo: ref = id odmiany (zgłaszany jest autor odmiany albo osoba, która dodała wspólne zdjęcie; userId z żądania ignorujemy).
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await jsonBody(req);
  if (!TYPES.includes(b.type)) return bad('Nieprawidłowe zgłoszenie.');
  if (!Object.keys(REASONS).includes(b.reason)) return bad('Wybierz powód zgłoszenia.');
  const refId = intId(b.ref) || null;
  let target = intId(b.userId);
  let ref = null;
  if (b.type === 'user') {
    if (!target || target === user.id) return bad('Nieprawidłowe zgłoszenie.');
    const [ok] = await sql()`SELECT 1 AS x FROM users WHERE id = ${target}`;
    if (!ok) return bad('Nie znaleziono zgłaszanej treści.', 404);
  } else if (b.type === 'test') {
    if (!target || target === user.id || !refId) return bad('Nieprawidłowe zgłoszenie.');
    // Zgłoszony test musi należeć do zgłaszanej osoby i być widoczny dla zgłaszającego: inaczej dowolny numer testu
    // pokazałby adminowi cudzą prywatną notatkę, a „usuń treść” skasowałoby test kogoś innego.
    const [ok] = await sql()`SELECT 1 AS x FROM strain_tests WHERE id = ${refId} AND user_id = ${target} AND can_see(${user.id}::int, user_id, visibility)`;
    if (!ok) return bad('Nie znaleziono zgłaszanej treści.', 404);
    ref = refId;
  } else {
    if (!refId) return bad('Nieprawidłowe zgłoszenie.');
    // odmiany i ich zdjęcia są wspólne (widoczne dla każdego zalogowanego); odpowiedzialny to autor odmiany albo autor zdjęcia
    const [row] = await sql()`SELECT s.created_by, p.uploaded_by, (p.strain_id IS NOT NULL) AS has_photo
                              FROM strains s LEFT JOIN strain_photos p ON p.strain_id = s.id WHERE s.id = ${refId}`;
    if (!row || (b.type === 'photo' && !row.has_photo)) return bad('Nie znaleziono zgłaszanej treści.', 404);
    target = b.type === 'photo' ? (row.uploaded_by || row.created_by) : row.created_by;
    // wpisy katalogu (bez autora) poprawia się przez propozycję zmiany, nie zgłoszenie osoby
    if (!target) return bad('Ta pozycja pochodzi z katalogu i nie ma autora. Zaproponuj poprawkę w szczegółach odmiany.', 422);
    if (target === user.id) return bad('To Twoja własna treść. Możesz ją edytować lub usunąć.');
    ref = refId;
  }
  if (!(await hit(`report:${user.id}`, 20, 3600))) return bad('Zbyt wiele zgłoszeń. Spróbuj ponownie później.', 429);
  const dup = await sql()`SELECT 1 FROM reports WHERE reporter_id = ${user.id} AND target_user_id = ${target} AND type = ${b.type}
                          AND ref IS NOT DISTINCT FROM ${ref}::int AND status = 'open'`;
  if (!dup.length) {
    await sql()`INSERT INTO reports (reporter_id, target_user_id, type, ref, reason, note)
                VALUES (${user.id}, ${target}, ${b.type}, ${ref}, ${b.reason}, ${String(b.note ?? '').trim().slice(0, 500)})`;
  }
  return NextResponse.json({ ok: true });
});
