import { ensureDb, sql } from './db';
import { sumByUnit } from './units';

// Dane raportu dla lekarza z okresu from..to (dni w czasie polskim, włącznie). Ilości w jednostce odmiany:
// susz w gramach, olej i pen w ml; sumy osobno dla każdej jednostki (totals.used / totals.bought: { g, ml }).
export async function doctorReport(userId, from, to) {
  await ensureDb();
  const q = sql();
  const [usage, weekly, purchases, feel, [sym]] = await Promise.all([
    q`SELECT s.name, s.producer, s.thc::float8 AS thc, s.cbd::float8 AS cbd, form_unit(s.form) AS unit, SUM(l.grams)::float8 AS grams,
        COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)::int AS days
      FROM usage_log l JOIN strains s ON s.id = l.strain_id
      WHERE l.user_id = ${userId} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY s.id ORDER BY form_unit(s.form), grams DESC`,
    q`SELECT to_char(date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw'), 'DD.MM') AS week,
        COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 AS grams,
        COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 AS ml
      FROM usage_log l JOIN strains s ON s.id = l.strain_id
      WHERE l.user_id = ${userId} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw') ORDER BY date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw')`,
    q`SELECT strain_name AS name, grams::float8 AS grams, cost::float8 AS cost, strain_unit(strain_id) AS unit,
        to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS at
      FROM purchases WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date ORDER BY created_at`,
    q`SELECT s.name, us.effects, us.rating::float8 AS rating, us.notes
      FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.user_id = ${userId} AND s.id IN (SELECT strain_id FROM usage_log WHERE user_id = ${userId}
        AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date) ORDER BY s.name`,
    q`SELECT COUNT(*)::int AS days, AVG(pain)::float8 AS pain, AVG(sleep)::float8 AS sleep, AVG(anxiety)::float8 AS anxiety, AVG(mood)::float8 AS mood
      FROM symptom_log WHERE user_id = ${userId} AND day BETWEEN ${from}::date AND ${to}::date`,
  ]);
  const totals = {
    used: sumByUnit(usage),
    bought: sumByUnit(purchases),
    cost: purchases.reduce((a, p) => a + (p.cost || 0), 0),
  };
  return { usage, weekly, purchases, feel, sym, totals };
}
