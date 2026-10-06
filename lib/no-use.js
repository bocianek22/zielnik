import { sql, ensureDb } from './db';

// POM-38: „Dzień bez zużycia”. Znacznik dnia (bez gramów) odróżnia „nie użyłem” od „nie wpisałem”.
// Wszystko po user_id z sesji; dzień z zapisanym zużyciem nie może być oznaczony (i zapis zużycia zdejmuje znacznik).
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function noUseToday(userId) {
  await ensureDb();
  const [r] = await sql()`SELECT EXISTS (SELECT 1 FROM no_use_days WHERE user_id = ${userId}::int
    AND day = (now() AT TIME ZONE 'Europe/Warsaw')::date) AS on`;
  return r.on;
}

// Zwraca { ok } albo { error, status }. Dzień: dziś albo do 30 dni wstecz (nadrabianie), nie z przyszłości.
export async function markNoUse(userId, day) {
  await ensureDb();
  const q = sql();
  const [r] = await q`WITH d AS (SELECT ${day}::date AS day)
    SELECT d.day > (now() AT TIME ZONE 'Europe/Warsaw')::date AS future,
      d.day < (now() AT TIME ZONE 'Europe/Warsaw')::date - 30 AS old,
      EXISTS (SELECT 1 FROM usage_log WHERE user_id = ${userId}::int AND grams > 0
        AND (created_at AT TIME ZONE 'Europe/Warsaw')::date = d.day) AS used
    FROM d`;
  if (r.future) return { error: 'Nie można oznaczyć dnia z przyszłości.', status: 400 };
  if (r.old) return { error: 'Można oznaczyć najwyżej 30 dni wstecz.', status: 400 };
  if (r.used) return { error: 'Tego dnia jest zapisane zużycie.', status: 409 };
  // jedno polecenie: zużycie zapisane w międzyczasie też blokuje znacznik
  const ins = await q`INSERT INTO no_use_days (user_id, day) SELECT ${userId}::int, ${day}::date
    WHERE NOT EXISTS (SELECT 1 FROM usage_log WHERE user_id = ${userId}::int AND grams > 0
      AND (created_at AT TIME ZONE 'Europe/Warsaw')::date = ${day}::date)
    ON CONFLICT DO NOTHING RETURNING day`;
  if (!ins.length && !(await q`SELECT 1 FROM no_use_days WHERE user_id = ${userId}::int AND day = ${day}::date`).length) {
    return { error: 'Tego dnia jest zapisane zużycie.', status: 409 };
  }
  return { ok: true };
}

export async function unmarkNoUse(userId, day) {
  await ensureDb();
  await sql()`DELETE FROM no_use_days WHERE user_id = ${userId}::int AND day = ${day}::date`;
}
