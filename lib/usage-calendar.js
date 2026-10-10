import { sql, ensureDb } from './db';
import { PERIODS } from './usage-meta';

// A5: dane do kalendarza zużycia i rozkładu pory przyjęcia w Historii. Tylko własne dane (user_id z sesji), dni w czasie polskim.
export const CAL_DAYS = 371; // 53 tygodnie wstecz: wystarcza na rok (4 kwartały po 13 tygodni) z zapasem na początek tygodnia

// { today, from, rows }: rows to tylko dni z czymkolwiek ({ day, g, ml, n, noUse }); puste dni dopowiada klient z `from`..`today`.
// Gramy (susz) i ml (olej, pen) osobno. Dzień ze zużyciem nie bywa jednocześnie „dniem bez zużycia” (POM-38), ale gdyby tak
// było w starych danych, zużycie wygrywa ze znacznikiem.
export async function usageCalendar(userId, days = CAL_DAYS) {
  await ensureDb();
  const q = sql();
  const span = Math.max(1, Math.min(CAL_DAYS, Math.floor(days)));
  const [t] = await q`SELECT to_char((now() AT TIME ZONE 'Europe/Warsaw')::date, 'YYYY-MM-DD') AS today,
    to_char((now() AT TIME ZONE 'Europe/Warsaw')::date - ${span - 1}::int, 'YYYY-MM-DD') AS from`;
  const rows = await q`
    WITH u AS (
      SELECT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date AS d,
             COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 AS g,
             COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 AS ml,
             COUNT(*)::int AS n
      FROM usage_log l JOIN strains s ON s.id = l.strain_id
      WHERE l.user_id = ${userId}::int AND l.grams > 0
        AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${t.from}::date AND ${t.today}::date
      GROUP BY 1)
    SELECT to_char(COALESCE(u.d, z.day), 'YYYY-MM-DD') AS day, COALESCE(u.g, 0)::float8 AS g, COALESCE(u.ml, 0)::float8 AS ml,
           COALESCE(u.n, 0)::int AS n, (u.d IS NULL AND z.day IS NOT NULL) AS "noUse"
    FROM u FULL JOIN (SELECT day FROM no_use_days WHERE user_id = ${userId}::int AND day BETWEEN ${t.from}::date AND ${t.today}::date) z ON z.day = u.d
    ORDER BY 1`;
  return { today: t.today, from: t.from, rows };
}

// Pora przyjęcia: liczba wpisów „Zużyłem” z ostatnich `days` dni wg pory dnia (pole `period` albo godzina zapisu, usage_period).
// Zawsze cztery pory w stałej kolejności; liczba wpisów, bez ilości (g i ml się nie mieszają).
export async function usagePeriods(userId, days = 90) {
  await ensureDb();
  const span = Math.max(1, Math.min(3650, Math.floor(days)));
  const found = await sql()`SELECT usage_period(period, created_at) AS key, COUNT(*)::int AS n FROM usage_log
    WHERE user_id = ${userId}::int AND grams > 0
      AND (created_at AT TIME ZONE 'Europe/Warsaw')::date > (now() AT TIME ZONE 'Europe/Warsaw')::date - ${span}::int
    GROUP BY 1`;
  const by = Object.fromEntries(found.map((r) => [r.key, r.n]));
  const rows = Object.entries(PERIODS).map(([key, label]) => ({ key, label, n: by[key] || 0 }));
  return { days: span, total: rows.reduce((a, r) => a + r.n, 0), rows };
}
