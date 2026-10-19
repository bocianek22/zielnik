import { sql, ensureDb } from './db';
import { LOCKED_NOTE, decryptField, planNote, rowScope } from './data-crypto';

// Inne przyjmowane leki: krótka lista do raportu dla lekarza (interakcje). Wszystko po user_id z sesji, bez udostępniania.
// Nazwa i dawka szyfrowane jak notatki (1.1.0); bez edycji, więc odczyt tylko do wyświetlenia (znacznik przy braku klucza).
export const MEDS_MAX = 15;
export const MED_NAME_LEN = 80;
export const MED_DOSE_LEN = 80;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export function openMed(userId, r) {
  const scope = rowScope('other_meds', { user_id: userId, id: r.id });
  return { ...r, name: decryptField('other_meds', 'name', scope, r.name), dose: r.dose ? decryptField('other_meds', 'dose', scope, r.dose) : '' };
}

export async function listMeds(userId) {
  await ensureDb();
  const u = Number(userId) || 0;
  return (await sql()`SELECT id, name, dose FROM other_meds WHERE user_id = ${u}::int ORDER BY created_at, id`).map((r) => openMed(u, r));
}

// { name, dose } jako wartości do zapisu w wierszu o danym id; null, gdy szyfrowanie jest chwilowo niedostępne (zły klucz)
export function planMed(userId, id, name, dose) {
  const scope = rowScope('other_meds', { user_id: userId, id });
  const n = planNote('other_meds', 'name', scope, name), d = planNote('other_meds', 'dose', scope, dose);
  return n.unavailable || d.unavailable || !n.value ? null : { name: n.value, dose: d.value };
}

// { name, dose } -> { med } albo { error, status }. Limit pilnuje jedno polecenie (INSERT ... WHERE liczba < limit).
export async function addMed(userId, input) {
  await ensureDb();
  const name = clean(input?.name), dose = clean(input?.dose);
  if (!name || name === LOCKED_NOTE) return { error: 'Wpisz nazwę leku.', status: 400 };
  if (name.length > MED_NAME_LEN) return { error: `Nazwa może mieć najwyżej ${MED_NAME_LEN} znaków.`, status: 400 };
  if (dose.length > MED_DOSE_LEN) return { error: `Dawkowanie może mieć najwyżej ${MED_DOSE_LEN} znaków.`, status: 400 };
  const u = Number(userId) || 0;
  const q = sql();
  // AAD szyfrogramu zawiera id wiersza, więc id z sekwencji przed INSERT (jak w wizytach)
  const [{ id }] = await q`SELECT nextval(pg_get_serial_sequence('other_meds', 'id'))::int AS id`;
  const enc = planMed(u, id, name, dose);
  if (!enc) return { error: 'Zapis jest chwilowo niedostępny. Spróbuj ponownie później.', status: 422 };
  const [med] = await q`INSERT INTO other_meds (id, user_id, name, dose)
    SELECT ${id}::int, ${u}::int, ${enc.name}::text, ${enc.dose}::text
    WHERE (SELECT COUNT(*) FROM other_meds WHERE user_id = ${u}::int) < ${MEDS_MAX}::int
    RETURNING id`;
  if (!med) return { error: `Możesz zapisać najwyżej ${MEDS_MAX} leków.`, status: 409 };
  return { med: { id, name, dose } };
}

export async function deleteMed(userId, id) {
  await ensureDb();
  return (await sql()`DELETE FROM other_meds WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id`).length > 0;
}
