import { ensureDb, sql } from './db';
import { CUSTOM_MAX, CUSTOM_NAME_MAX, cleanCustomName } from './symptoms';

// Własne objawy (POM-07). Wszystko po user_id z sesji; limit 3 pilnują miejsca 1-3 i klucz unikalny (user_id, slot).
const toDef = (r) => ({ id: r.id, slot: r.slot, name: r.name, higherBetter: r.higher_better });

export async function listCustom(userId) {
  await ensureDb();
  const rows = await sql()`SELECT id, slot, name, higher_better FROM symptom_custom WHERE user_id = ${userId}::int ORDER BY slot`;
  return rows.map(toDef);
}

// Wartości z ostatnich `days` dni: [{ day, id, value }]
export async function customValues(userId, days = 60) {
  await ensureDb();
  return sql()`SELECT to_char(day, 'YYYY-MM-DD') AS day, custom_id AS id, value FROM symptom_values
               WHERE user_id = ${userId}::int AND day >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int ORDER BY day, custom_id`;
}

// Zwraca { def } albo { error, status }. Wolne miejsce wybiera sam INSERT (najniższe wolne), więc dwa równoległe
// zapisy nie przekroczą limitu: drugi trafia na ten sam klucz i nic nie wstawia.
export async function createCustom(userId, input) {
  await ensureDb();
  const name = cleanCustomName(input.name);
  if (!name) return { error: 'Podaj nazwę objawu.', status: 400 };
  if (String(input.name).trim().length > CUSTOM_NAME_MAX) return { error: `Nazwa może mieć najwyżej ${CUSTOM_NAME_MAX} znaków.`, status: 400 };
  const better = input.higherBetter === true;
  const q = sql();
  for (let attempt = 0; attempt < 3; attempt++) {
    const [row] = await q`
      INSERT INTO symptom_custom (user_id, slot, name, higher_better)
      SELECT ${userId}::int, s, ${name}::text, ${better}::boolean FROM generate_series(1, ${CUSTOM_MAX}::int) s
      WHERE NOT EXISTS (SELECT 1 FROM symptom_custom WHERE user_id = ${userId}::int AND slot = s)
      ORDER BY s LIMIT 1
      ON CONFLICT DO NOTHING
      RETURNING id, slot, name, higher_better`;
    if (row) return { def: toDef(row) };
    const [c] = await q`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE lower(name) = lower(${name}::text))::int AS same
                        FROM symptom_custom WHERE user_id = ${userId}::int`;
    if (c.same > 0) return { error: 'Masz już własny objaw o takiej nazwie.', status: 409 };
    if (c.n >= CUSTOM_MAX) return { error: `Możesz mieć najwyżej ${CUSTOM_MAX} własne objawy. Usuń jeden, aby dodać nowy.`, status: 409 };
    // wyścig o to samo miejsce: próbujemy ponownie
  }
  return { error: 'Nie udało się dodać objawu. Spróbuj ponownie.', status: 409 };
}

// Zmiana nazwy i/lub kierunku (wartości zostają, zmienia się tylko opis skali)
export async function updateCustom(userId, id, input) {
  await ensureDb();
  const hasName = input.name !== undefined;
  const name = hasName ? cleanCustomName(input.name) : null;
  if (hasName && !name) return { error: 'Podaj nazwę objawu.', status: 400 };
  if (hasName && String(input.name).trim().length > CUSTOM_NAME_MAX) return { error: `Nazwa może mieć najwyżej ${CUSTOM_NAME_MAX} znaków.`, status: 400 };
  const better = typeof input.higherBetter === 'boolean' ? input.higherBetter : null;
  try {
    const [row] = await sql()`UPDATE symptom_custom SET name = COALESCE(${name}::text, name), higher_better = COALESCE(${better}::boolean, higher_better)
      WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id, slot, name, higher_better`;
    if (!row) return { error: 'Nie znaleziono objawu.', status: 404 };
    return { def: toDef(row) };
  } catch (e) {
    if (e?.code === '23505') return { error: 'Masz już własny objaw o takiej nazwie.', status: 409 };
    throw e;
  }
}

// Usuwa objaw razem z wartościami (kaskada). Zwraca liczbę usuniętych dni z wartością albo null, gdy to nie Twój objaw.
export async function deleteCustom(userId, id) {
  await ensureDb();
  const [r] = await sql()`WITH v AS (SELECT COUNT(*)::int AS n FROM symptom_values WHERE custom_id = ${id}::int AND user_id = ${userId}::int),
    d AS (DELETE FROM symptom_custom WHERE id = ${id}::int AND user_id = ${userId}::int RETURNING id)
    SELECT (SELECT COUNT(*)::int FROM d) AS gone, v.n AS removed FROM v`;
  return r.gone ? r.removed : null;
}
