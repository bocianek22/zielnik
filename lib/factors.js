import { ensureDb, sql } from './db';

// Czynniki dnia (POM-47): własne etykiety kontekstu dnia, np. „stres”, „ruch”, „kofeina”. Wszystko po user_id z sesji;
// limit FACTOR_MAX pilnują miejsca 1..FACTOR_MAX i klucz unikalny (user_id, slot), jak przy własnych objawach.
import { FACTOR_MAX, FACTOR_NAME_MAX, cleanFactorName } from './factors-meta.js';

export { FACTOR_MAX, FACTOR_NAME_MAX, cleanFactorName };
const toDef = (r) => ({ id: r.id, slot: r.slot, name: r.name });

export async function listFactors(userId) {
  await ensureDb();
  return (await sql()`SELECT id, slot, name FROM day_factors WHERE user_id = ${userId}::int ORDER BY slot`).map(toDef);
}

// Znaczniki z ostatnich `days` dni (i dodatkowo extraDay): [{ day, id }]
export async function factorMarks(userId, days = 60, extraDay = null) {
  await ensureDb();
  return sql()`SELECT to_char(day, 'YYYY-MM-DD') AS day, factor_id AS id FROM day_factor_marks
    WHERE user_id = ${userId}::int AND (day >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int OR day = ${extraDay}::date)
    ORDER BY day, factor_id`;
}

export async function createFactor(userId, input) {
  await ensureDb();
  const name = cleanFactorName(input?.name);
  if (!name) return { error: 'Podaj nazwę czynnika.', status: 400 };
  if (String(input.name).replace(/\s+/g, ' ').trim().length > FACTOR_NAME_MAX) return { error: `Nazwa może mieć najwyżej ${FACTOR_NAME_MAX} znaków.`, status: 400 };
  const q = sql();
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await q`
      INSERT INTO day_factors (user_id, slot, name)
      SELECT ${userId}::int, s, ${name}::text FROM generate_series(1, ${FACTOR_MAX}::int) s
      WHERE NOT EXISTS (SELECT 1 FROM day_factors WHERE user_id = ${userId}::int AND slot = s)
      ORDER BY s LIMIT 1
      ON CONFLICT DO NOTHING
      RETURNING id, slot, name`;
    if (row) return { def: toDef(row) };
    const [c] = await q`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE lower(name) = lower(${name}::text))::int AS same
                        FROM day_factors WHERE user_id = ${userId}::int`;
    if (c.same > 0) return { error: 'Masz już czynnik o takiej nazwie.', status: 409 };
    if (c.n >= FACTOR_MAX) return { error: `Możesz mieć najwyżej ${FACTOR_MAX} czynników. Usuń jeden, aby dodać nowy.`, status: 409 };
  }
  return { error: 'Nie udało się dodać czynnika. Spróbuj ponownie.', status: 409 };
}

export async function renameFactor(userId, id, input) {
  await ensureDb();
  const name = cleanFactorName(input?.name);
  if (!name) return { error: 'Podaj nazwę czynnika.', status: 400 };
  try {
    const [row] = await sql()`UPDATE day_factors SET name = ${name} WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id, slot, name`;
    return row ? { def: toDef(row) } : { error: 'Nie znaleziono czynnika.', status: 404 };
  } catch (e) {
    if (e?.code === '23505') return { error: 'Masz już czynnik o takiej nazwie.', status: 409 };
    throw e;
  }
}

// Usuwa czynnik razem ze znacznikami (kaskada); false, gdy to nie Twój czynnik
export async function deleteFactor(userId, id) {
  await ensureDb();
  return (await sql()`DELETE FROM day_factors WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id`).length > 0;
}
