import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { planNote, NOTE_UNAVAILABLE_REJECT_MSG } from '@/lib/data-crypto';
import { parseBatch, batchScope, openBatch } from '@/lib/batches';

// POM-32: notatka o partii przy własnym zakupie. { batchNo?, batchExpires? (RRRR-MM-DD), batchEffect? ('weaker' | 'usual' | 'stronger'), batchNote? }
// Zapis zastępuje wszystkie pola partii (puste pole = wyczyszczone); pominięte batchNote zostawia notatkę bez zmian.
// Dane prywatne: zakup cudzy albo nieistniejący = 404, bez rozróżnienia.
export const PUT = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const b = parseBatch(await jsonBody(req));
  if (b.error) return bad(b.error);
  if (!id) return bad('Nie znaleziono zakupu.', 404);
  if (!(await hit(`batch:${user.id}`, 200, 3600))) return bad('Zbyt wiele zmian. Spróbuj ponownie za chwilę.', 429);
  const [cur] = await sql()`SELECT batch_note FROM purchases WHERE id = ${id}::int AND user_id = ${user.id}::int`;
  if (!cur) return bad('Nie znaleziono zakupu.', 404);
  // brak batchNote = zachowaj; inaczej planNote (zaszyfruj, zachowaj nieczytelny szyfrogram przy pustym polu, odrzuć przy złej konfiguracji)
  const plan = b.note === undefined ? { value: cur.batch_note, keep: true, unavailable: false }
    : planNote('purchases', 'batch_note', batchScope(user.id, id), b.note, cur.batch_note);
  if (plan.unavailable && b.note !== undefined) return bad(NOTE_UNAVAILABLE_REJECT_MSG, 422);
  const [row] = await sql()`UPDATE purchases SET batch_no = ${b.no}::text, batch_expires_on = ${b.expires}::date, batch_effect = ${b.effect}::text,
      batch_note = CASE WHEN ${plan.keep}::boolean THEN batch_note ELSE ${plan.value}::text END
    WHERE id = ${id}::int AND user_id = ${user.id}::int
    RETURNING id, batch_no AS "batchNo", to_char(batch_expires_on, 'YYYY-MM-DD') AS "batchExpires", batch_effect AS "batchEffect", batch_note AS "batchNote"`;
  if (!row) return bad('Nie znaleziono zakupu.', 404);
  return NextResponse.json({ batch: openBatch(user.id, row) });
});
