// POM-32: notatka o partii przy zakupie (server). Dane prywatne: każde zapytanie zawęża do user_id z sesji, bez can_see.
import { sql } from './db';
import { openEditable, LOCKED_NOTE } from './data-crypto';
import { BATCH_EFFECTS, BATCH_NO_MAX, BATCH_NOTE_MAX, validBatchDay } from './batch-meta';

// Wejście trasy -> { no, expires, effect, note } albo { error }. note === undefined = nie zmieniaj notatki.
export function parseBatch(b) {
  const no = String(b.batchNo ?? '').trim();
  if (no.length > BATCH_NO_MAX) return { error: `Numer partii może mieć najwyżej ${BATCH_NO_MAX} znaków.` };
  if (/[\u0000-\u001f\u007f]/.test(no)) return { error: 'Numer partii zawiera niedozwolone znaki.' };
  const expires = b.batchExpires == null || b.batchExpires === '' ? null : String(b.batchExpires);
  if (expires && !validBatchDay(expires)) return { error: 'Data ważności musi mieć postać RRRR-MM-DD.' };
  const effect = b.batchEffect == null || b.batchEffect === '' ? null : String(b.batchEffect);
  if (effect && !Object.hasOwn(BATCH_EFFECTS, effect)) return { error: 'Nieznana ocena partii.' };
  let note;
  if (b.batchNote !== undefined) {
    note = String(b.batchNote ?? '').trim();
    if (note === LOCKED_NOTE) note = undefined; // znacznik nieczytelnej notatki nie jest treścią
    else if (note.length > BATCH_NOTE_MAX) return { error: `Notatka o partii może mieć najwyżej ${BATCH_NOTE_MAX} znaków.` };
  }
  return { no, expires, effect, note };
}

// Zakres szyfrowania (data-crypto): konto + id zakupu
export const batchScope = (userId, id) => `${userId}|${id}`;

// Wiersz z polami batchNo/batchExpires/batchEffect/batchNote (surowa kolumna) -> notatka odszyfrowana do edycji
// (nieczytelny szyfrogram = batchNote '' i batchNoteLocked: true)
export const openBatch = (userId, r) => openEditable('purchases', 'batch_note', batchScope(userId, r.id), r, 'batchNote');

// Zakupy odmiany (najnowsze najpierw, 20) z notatkami o partiach: karta odmiany. Tylko zakupy właściciela.
export async function strainBatches(userId, strainId) {
  const rows = await sql()`SELECT id, grams::float8 AS grams, strain_unit(strain_id) AS unit,
      to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day,
      batch_no AS "batchNo", to_char(batch_expires_on, 'YYYY-MM-DD') AS "batchExpires", batch_effect AS "batchEffect", batch_note AS "batchNote"
    FROM purchases WHERE user_id = ${userId}::int AND strain_id = ${strainId}::int ORDER BY created_at DESC, id DESC LIMIT 20`;
  return rows.map((r) => openBatch(userId, r));
}
