import { sql, ensureDb } from './db';

// Inne przyjmowane leki: krótka lista do raportu dla lekarza (interakcje). Wszystko po user_id z sesji, bez udostępniania.
export const MEDS_MAX = 15;
export const MED_NAME_LEN = 80;
export const MED_DOSE_LEN = 80;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export async function listMeds(userId) {
  await ensureDb();
  return sql()`SELECT id, name, dose FROM other_meds WHERE user_id = ${userId}::int ORDER BY created_at, id`;
}

// { name, dose } -> { med } albo { error, status }. Limit pilnuje jedno polecenie (INSERT ... WHERE liczba < limit).
export async function addMed(userId, input) {
  await ensureDb();
  const name = clean(input?.name), dose = clean(input?.dose);
  if (!name) return { error: 'Wpisz nazwę leku.', status: 400 };
  if (name.length > MED_NAME_LEN) return { error: `Nazwa może mieć najwyżej ${MED_NAME_LEN} znaków.`, status: 400 };
  if (dose.length > MED_DOSE_LEN) return { error: `Dawkowanie może mieć najwyżej ${MED_DOSE_LEN} znaków.`, status: 400 };
  const [med] = await sql()`INSERT INTO other_meds (user_id, name, dose)
    SELECT ${userId}::int, ${name}::text, ${dose}::text
    WHERE (SELECT COUNT(*) FROM other_meds WHERE user_id = ${userId}::int) < ${MEDS_MAX}::int
    RETURNING id, name, dose`;
  if (!med) return { error: `Możesz zapisać najwyżej ${MEDS_MAX} leków.`, status: 409 };
  return { med };
}

export async function deleteMed(userId, id) {
  await ensureDb();
  return (await sql()`DELETE FROM other_meds WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id`).length > 0;
}
