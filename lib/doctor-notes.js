import { sql, ensureDb } from './db';
import { LOCKED_NOTE, decryptField, planNote, rowScope } from './data-crypto';

// POM-36: „Do omówienia z lekarzem”. Wszystko po user_id z sesji; najwyżej NOTES_MAX nieomówionych punktów.
// Treść szyfrowana jak inne notatki (1.1.0); punktów nie da się edytować, więc odczyt tylko do wyświetlenia (znacznik przy braku klucza).
export const NOTES_MAX = 10;
export const NOTE_LEN = 200;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export const openNote = (userId, r) => ({ ...r, text: decryptField('doctor_notes', 'text', rowScope('doctor_notes', { user_id: userId, id: r.id }), r.text) });

export async function listNotes(userId) {
  await ensureDb();
  const u = Number(userId) || 0;
  return (await sql()`SELECT id, text, done, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS created
    FROM doctor_notes WHERE user_id = ${u}::int ORDER BY done, created_at, id`).map((r) => openNote(u, r));
}

// Zwraca { note } albo { error, status }. Limit pilnuje jedno polecenie (INSERT ... WHERE liczba < limit).
export async function addNote(userId, raw) {
  await ensureDb();
  const text = clean(raw);
  if (!text || text === LOCKED_NOTE) return { error: 'Wpisz, co chcesz omówić.', status: 400 };
  if (text.length > NOTE_LEN) return { error: `Punkt może mieć najwyżej ${NOTE_LEN} znaków.`, status: 400 };
  const u = Number(userId) || 0;
  const q = sql();
  // AAD szyfrogramu zawiera id wiersza, więc id z sekwencji przed INSERT (jak w wizytach)
  const [{ id }] = await q`SELECT nextval(pg_get_serial_sequence('doctor_notes', 'id'))::int AS id`;
  const plan = planNote('doctor_notes', 'text', rowScope('doctor_notes', { user_id: u, id }), text);
  if (plan.unavailable || !plan.value) return { error: 'Zapis jest chwilowo niedostępny. Spróbuj ponownie później.', status: 422 };
  const [note] = await q`INSERT INTO doctor_notes (id, user_id, text)
    SELECT ${id}::int, ${u}::int, ${plan.value}::text
    WHERE (SELECT COUNT(*) FROM doctor_notes WHERE user_id = ${u}::int AND NOT done) < ${NOTES_MAX}::int
    RETURNING id, done, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS created`;
  if (!note) return { error: `Możesz mieć najwyżej ${NOTES_MAX} punktów do omówienia. Odhacz omówione albo usuń niepotrzebne.`, status: 409 };
  return { note: { ...note, text } };
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
