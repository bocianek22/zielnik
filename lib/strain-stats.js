import { ensureDb, sql } from './db';

export const STATS_WEEKS = 12;

// "Moje statystyki" na stronie odmiany: wyłącznie dane właściciela (userId z sesji), nigdy cudze zużycia ani zakupy.
// Wszystkie granice dni i tygodni w czasie polskim (tydzień od poniedziałku, jak date_trunc('week')).
// Średnio dziennie = zużycie z ostatnich 12 tygodni / liczba dni od pierwszego użycia w tym okresie do dziś (włącznie).
// Dni temu i datę ostatniego użycia liczy baza, żeby serwer (UTC) i telefon pokazały to samo.
export async function strainStats(userId, strainId) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const s = Number(strainId) || 0;
  const [[tot], weeks] = await Promise.all([
    q`WITH me AS (
        SELECT grams, (created_at AT TIME ZONE 'Europe/Warsaw') AS t FROM usage_log WHERE user_id = ${u} AND strain_id = ${s}
      ), today AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d),
      win AS (SELECT (date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '11 weeks')::date AS d)
      SELECT
        (SELECT COALESCE(SUM(grams), 0)::float8 FROM purchases WHERE user_id = ${u} AND strain_id = ${s}) AS bought,
        (SELECT COUNT(*)::int FROM purchases WHERE user_id = ${u} AND strain_id = ${s}) AS purchases,
        (SELECT COALESCE(SUM(grams), 0)::float8 FROM me) AS used,
        (SELECT COUNT(*)::int FROM me) AS uses,
        (SELECT COALESCE(SUM(grams), 0)::float8 FROM me, win WHERE t::date >= win.d) AS used_window,
        (SELECT (today.d - MIN(t::date) + 1)::int FROM me, win, today WHERE t::date >= win.d GROUP BY today.d) AS window_days,
        (SELECT to_char(MAX(t), 'YYYY-MM-DD') FROM me) AS last_use,
        (SELECT (today.d - MAX(t)::date)::int FROM me, today GROUP BY today.d) AS last_days_ago`,
    q`SELECT to_char(w, 'YYYY-MM-DD') AS week, COALESCE(SUM(l.grams), 0)::float8 AS grams
      FROM generate_series(date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '11 weeks',
                           date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw'), interval '1 week') AS w
      LEFT JOIN usage_log l ON l.user_id = ${u} AND l.strain_id = ${s}
        AND date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw') = w
      GROUP BY w ORDER BY w`,
  ]);
  const perDay = tot.window_days ? tot.used_window / tot.window_days : null;
  return {
    bought: tot.bought, purchases: tot.purchases, used: tot.used, uses: tot.uses,
    perDay: perDay == null ? null : Math.round(perDay * 100) / 100,
    lastUse: tot.last_use, lastDaysAgo: tot.last_days_ago,
    weeks: weeks.map((w) => ({ week: w.week, grams: Math.round(w.grams * 100) / 100 })),
  };
}
