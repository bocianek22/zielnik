import { ensureDb, sql } from './db';
import { decryptField, LOCKED_NOTE, rowScope } from './data-crypto';

// „Karta dnia” (0.60.0): wszystko z jednego dnia (czas polski) w jednym miejscu: zużycie z porą i sposobem, zakupy,
// wpis objawów (z własnymi objawami), oznaczenie „dzień bez zużycia”. Tylko dane właściciela (userId z sesji).
// Bez ocen dnia i porównań; ilości osobno w jednostce odmiany.
export async function dayCard(userId, day) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const [usage, purchases, [sym], custom, [mark], factors, visits] = await Promise.all([
    q`SELECT s.id AS "strainId", s.name, form_unit(s.form) AS unit, l.grams::float8 AS amount, l.method,
        usage_period(l.period, l.created_at) AS period, to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI') AS time
      FROM usage_log l JOIN strains s ON s.id = l.strain_id
      WHERE l.user_id = ${u} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date = ${day}::date
      ORDER BY l.created_at, l.id`,
    q`SELECT strain_id AS "strainId", strain_name AS name, strain_unit(strain_id) AS unit, grams::float8 AS amount,
        to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'HH24:MI') AS time
      FROM purchases WHERE user_id = ${u} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date = ${day}::date
      ORDER BY created_at, id`,
    q`SELECT pain, sleep, anxiety, mood, note FROM symptom_log WHERE user_id = ${u} AND day = ${day}::date`,
    q`SELECT c.id, c.name, v.value FROM symptom_values v JOIN symptom_custom c ON c.id = v.custom_id
      WHERE v.user_id = ${u} AND v.day = ${day}::date ORDER BY c.slot`,
    q`SELECT 1 AS hit FROM no_use_days WHERE user_id = ${u} AND day = ${day}::date`,
    q`SELECT f.name FROM day_factor_marks m JOIN day_factors f ON f.id = m.factor_id
      WHERE m.user_id = ${u} AND m.day = ${day}::date ORDER BY f.slot`,
    q`SELECT id, note FROM visits WHERE user_id = ${u} AND day = ${day}::date ORDER BY id`,
  ]);
  const note = sym?.note ? decryptField('symptom_log', 'note', rowScope('symptom_log', { user_id: u, day }), sym.note) : '';
  return {
    day,
    usage,
    purchases,
    symptoms: sym || custom.length ? {
      pain: sym?.pain ?? null, sleep: sym?.sleep ?? null, anxiety: sym?.anxiety ?? null, mood: sym?.mood ?? null,
      note: note === LOCKED_NOTE ? '' : note, noteLocked: note === LOCKED_NOTE,
      custom: custom.map((c) => ({ id: c.id, name: c.name, value: c.value })),
    } : null,
    noUse: !!mark,
    factors: factors.map((f) => f.name), // czynniki dnia (POM-47)
    // wizyty (POM-52): notatka odszyfrowana; nieczytelna jako pusta z flagą
    visits: visits.map((v) => {
      const t = v.note ? decryptField('visits', 'note', rowScope('visits', { user_id: u, id: v.id }), v.note) : '';
      return { note: t === LOCKED_NOTE ? '' : t, noteLocked: t === LOCKED_NOTE };
    }),
  };
}
