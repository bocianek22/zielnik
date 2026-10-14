import { ensureDb, sql } from './db';
import { isIsoDay, todayPL } from './date';
import { MEASURE_MAX, MEASURE_NAME_MAX, MEASURE_UNIT_MAX, cleanMeasureName, cleanMeasureUnit, parseMeasure } from './measures-meta';

// Własne pomiary (POM-63): definicje (nazwa, jednostka) i jedna wartość na dzień. Wszystko po user_id z sesji; limit 3
// pilnują miejsca 1-3 i klucz unikalny (user_id, slot), jak we własnych objawach (lib/symptoms-custom.js).
const toDef = (r) => ({ id: r.id, slot: r.slot, name: r.name, unit: r.unit });
export const RECENT_DAYS = 30;

export async function listMeasures(userId) {
  await ensureDb();
  return (await sql()`SELECT id, slot, name, unit FROM measure_defs WHERE user_id = ${Number(userId) || 0}::int ORDER BY slot`).map(toDef);
}

// Wartości z ostatnich `days` dni: [{ day, id, value }], najnowsze najpierw
export async function measureValues(userId, days = RECENT_DAYS) {
  await ensureDb();
  return sql()`SELECT to_char(day, 'YYYY-MM-DD') AS day, def_id AS id, value::float8 AS value FROM measure_values
    WHERE user_id = ${Number(userId) || 0}::int AND day >= (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int
    ORDER BY day DESC, def_id`;
}

// najpierw czyszczenie (znaki sterujące -> spacje), potem pustość i długość: sama „\u0001” to pusta nazwa (400), nie błąd CHECK
const longer = (v, max) => [...String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()].length > max;
// Wartości z jednego dnia (dzień spoza listy ostatnich 30 dni w formularzu): [{ day, id, value }]
export async function measureDay(userId, day) {
  await ensureDb();
  if (!isIsoDay(day)) return [];
  return sql()`SELECT to_char(day, 'YYYY-MM-DD') AS day, def_id AS id, value::float8 AS value FROM measure_values
    WHERE user_id = ${Number(userId) || 0}::int AND day = ${day}::date ORDER BY def_id`;
}

function checkName(input) {
  if (longer(input, MEASURE_NAME_MAX)) return { error: `Nazwa może mieć najwyżej ${MEASURE_NAME_MAX} znaków.` };
  const name = cleanMeasureName(input);
  return name ? { name } : { error: 'Podaj nazwę pomiaru.' };
}
function checkUnit(input) {
  if (longer(input, MEASURE_UNIT_MAX)) return { error: `Jednostka może mieć najwyżej ${MEASURE_UNIT_MAX} znaków.` };
  return { unit: cleanMeasureUnit(input) };
}

// { name, unit } -> { def } albo { error, status }. Wolne miejsce wybiera sam INSERT (najniższe wolne).
export async function createMeasure(userId, input) {
  await ensureDb();
  const u = Number(userId) || 0;
  const n = checkName(input?.name);
  if (n.error) return { error: n.error, status: 400 };
  const un = checkUnit(input?.unit);
  if (un.error) return { error: un.error, status: 400 };
  const q = sql();
  for (let attempt = 0; attempt < 3; attempt++) {
    let row;
    try {
      [row] = await q`
        INSERT INTO measure_defs (user_id, slot, name, unit)
        SELECT ${u}::int, s, ${n.name}::text, ${un.unit}::text FROM generate_series(1, ${MEASURE_MAX}::int) s
        WHERE NOT EXISTS (SELECT 1 FROM measure_defs WHERE user_id = ${u}::int AND slot = s)
        ORDER BY s LIMIT 1
        ON CONFLICT (user_id, slot) DO NOTHING
        RETURNING id, slot, name, unit`;
    } catch (e) {
      if (e?.code === '23505') return { error: 'Masz już pomiar o takiej nazwie.', status: 409 };
      throw e;
    }
    if (row) return { def: toDef(row) };
    const [c] = await q`SELECT COUNT(*)::int AS n FROM measure_defs WHERE user_id = ${u}::int`;
    if (c.n >= MEASURE_MAX) return { error: `Możesz mieć najwyżej ${MEASURE_MAX} pomiary. Usuń jeden, aby dodać nowy.`, status: 409 };
  }
  return { error: 'Nie udało się dodać pomiaru. Spróbuj ponownie.', status: 409 };
}

// Zmiana nazwy i/lub jednostki (wartości zostają)
export async function updateMeasure(userId, id, input) {
  await ensureDb();
  const n = input?.name !== undefined ? checkName(input.name) : {};
  if (n.error) return { error: n.error, status: 400 };
  const un = input?.unit !== undefined ? checkUnit(input.unit) : {};
  if (un.error) return { error: un.error, status: 400 };
  try {
    const [row] = await sql()`UPDATE measure_defs SET name = COALESCE(${n.name ?? null}::text, name), unit = COALESCE(${un.unit ?? null}::text, unit)
      WHERE id = ${Number(id) || 0}::int AND user_id = ${Number(userId) || 0}::int RETURNING id, slot, name, unit`;
    if (!row) return { error: 'Nie znaleziono pomiaru.', status: 404 };
    return { def: toDef(row) };
  } catch (e) {
    if (e?.code === '23505') return { error: 'Masz już pomiar o takiej nazwie.', status: 409 };
    throw e;
  }
}

// Usuwa pomiar razem z wartościami (kaskada). Liczba usuniętych dni albo null, gdy to nie Twój pomiar.
export async function deleteMeasure(userId, id) {
  await ensureDb();
  const u = Number(userId) || 0, i = Number(id) || 0;
  const [r] = await sql()`WITH v AS (SELECT COUNT(*)::int AS n FROM measure_values WHERE def_id = ${i}::int AND user_id = ${u}::int),
    d AS (DELETE FROM measure_defs WHERE id = ${i}::int AND user_id = ${u}::int RETURNING id)
    SELECT (SELECT COUNT(*)::int FROM d) AS gone, v.n AS removed FROM v`;
  return r.gone ? r.removed : null;
}

// { day, values: { [defId]: '72,5' | '' } } -> { ok } albo { error, status }. Pusta wartość usuwa pomiar z tego dnia.
// Tylko własne definicje (JOIN po user_id); dzień od 2000-01-01 do dziś (czas polski).
export async function saveMeasureDay(userId, input) {
  await ensureDb();
  const u = Number(userId) || 0;
  const day = String(input?.day ?? '');
  if (!isIsoDay(day) || day < '2000-01-01' || day > todayPL()) return { error: 'Podaj poprawną datę (nie z przyszłości).', status: 400 };
  const src = input?.values && typeof input.values === 'object' && !Array.isArray(input.values) ? input.values : null;
  if (!src) return { error: 'Brak wartości.', status: 400 };
  const entries = Object.entries(src).slice(0, MEASURE_MAX * 2);
  const set = [], clear = [];
  for (const [k, raw] of entries) {
    const id = Number(k);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) return { error: 'Nieprawidłowy pomiar.', status: 400 };
    const v = parseMeasure(raw);
    if (Number.isNaN(v)) return { error: 'Wpisz liczbę, np. 72,5.', status: 400 };
    if (v == null) clear.push(id); else set.push({ id, v });
  }
  const q = sql();
  const ops = [];
  if (set.length) ops.push(q`INSERT INTO measure_values (def_id, user_id, day, value)
    SELECT d.id, ${u}::int, ${day}::date, x.v FROM jsonb_to_recordset(${JSON.stringify(set)}::jsonb) AS x(id int, v numeric)
    JOIN measure_defs d ON d.id = x.id AND d.user_id = ${u}::int
    ON CONFLICT (def_id, day) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`);
  if (clear.length) ops.push(q`DELETE FROM measure_values WHERE user_id = ${u}::int AND day = ${day}::date
    AND def_id IN (SELECT (jsonb_array_elements_text(${JSON.stringify(clear)}::jsonb))::int)`);
  if (ops.length) await q.transaction(ops);
  return { ok: true };
}
