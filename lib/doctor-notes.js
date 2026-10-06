import { sql, ensureDb } from './db';

// POM-36: „Do omówienia z lekarzem”. Wszystko po user_id z sesji; najwyżej NOTES_MAX nieomówionych punktów.
export const NOTES_MAX = 10;
export const NOTE_LEN = 200;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export async function listNotes(userId) {
  await ensureDb();
  return sql()`SELECT id, text, done, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS created
    FROM doctor_notes WHERE user_id = ${userId}::int ORDER BY done, created_at, id`;
}

// Zwraca { note } albo { error, status }. Limit pilnuje jedno polecenie (INSERT ... WHERE liczba < limit).
export async function addNote(userId, raw) {
  await ensureDb();
  const text = clean(raw);
  if (!text) return { error: 'Wpisz, co chcesz omówić.', status: 400 };
  if (text.length > NOTE_LEN) return { error: `Punkt może mieć najwyżej ${NOTE_LEN} znaków.`, status: 400 };
  const [note] = await sql()`INSERT INTO doctor_notes (user_id, text)
    SELECT ${userId}::int, ${text}::text
    WHERE (SELECT COUNT(*) FROM doctor_notes WHERE user_id = ${userId}::int AND NOT done) < ${NOTES_MAX}::int
    RETURNING id, text, done, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS created`;
  if (!note) return { error: `Możesz mieć najwyżej ${NOTES_MAX} punktów do omówienia. Odhacz omówione albo usuń niepotrzebne.`, status: 409 };
  return { note };
}

export async function setDone(userId, id, done) {
  await ensureDb();
  const [r] = await sql()`UPDATE doctor_notes SET done = ${!!done}::boolean, done_at = CASE WHEN ${!!done}::boolean THEN now() END
    WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id`;
  return !!r;
}

export async function deleteNote(userId, id) {
  await ensureDb();
  const r = await sql()`DELETE FROM doctor_notes WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id`;
  return r.length > 0;
}
