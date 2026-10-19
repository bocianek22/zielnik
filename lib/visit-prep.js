import { ensureDb, sql } from './db';
import { weekTrends } from './week-calc';
import { canUse } from './plans';

// „Przed wizytą”: gdy w dzienniku wizyt jest wizyta w ciągu PREP_DAYS dni, panel „Dziś” zbiera to, co przyda się
// w gabinecie: średnie objawów od ostatniej wizyty (z porównaniem do okresu tej samej długości wcześniej), liczbę
// punktów „Do omówienia” i okres do raportu. Jedno zapytanie, tylko dane właściciela (userId z sesji), bez zużycia.
export const PREP_DAYS = 7;
// bez wcześniejszej wizyty (albo bardzo dawno) liczymy z ostatnich DEFAULT_SPAN dni, najwyżej MAX_SPAN
export const DEFAULT_SPAN = 30;
export const MAX_SPAN = 365;

export async function visitPrep(userId, now = new Date()) {
  await ensureDb();
  const u = Number(userId) || 0;
  const [r] = await sql()`WITH t AS (SELECT (${new Date(now).toISOString()}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date AS d),
    -- najbliższa wizyta z dziennika wizyt albo z daty w przypomnieniach (push_prefs.next_visit_on)
    nx AS (SELECT MIN(x.day) AS day FROM t, (
        SELECT day FROM visits WHERE user_id = ${u}
        UNION ALL SELECT next_visit_on FROM push_prefs WHERE user_id = ${u}) x
      WHERE x.day BETWEEN t.d AND t.d + ${PREP_DAYS}::int),
    ls AS (SELECT MAX(v.day) AS day FROM visits v, t WHERE v.user_id = ${u} AND v.day < t.d),
    p AS (SELECT t.d, nx.day AS next, ls.day AS last,
            GREATEST(COALESCE(ls.day, t.d - ${DEFAULT_SPAN - 1}::int), t.d - ${MAX_SPAN - 1}::int) AS since FROM t, nx, ls)
    SELECT to_char(p.next, 'YYYY-MM-DD') AS next, (p.next - p.d)::int AS days_to,
      to_char(p.last, 'YYYY-MM-DD') AS last, to_char(p.since, 'YYYY-MM-DD') AS since, to_char(p.d, 'YYYY-MM-DD') AS today,
      (SELECT COUNT(*) FROM doctor_notes WHERE user_id = ${u} AND NOT done)::int AS notes,
      -- dni z co najmniej jedną oceną (sama notatka albo wyczyszczony wpis się nie liczą)
      (SELECT COUNT(*) FROM symptom_log s WHERE s.user_id = ${u} AND s.day BETWEEN p.since AND p.d
         AND num_nonnulls(s.pain, s.sleep, s.anxiety, s.mood) > 0)::int AS days,
      (SELECT plan FROM users WHERE id = ${u}) AS plan, (SELECT plan_until FROM users WHERE id = ${u}) AS plan_until,
      a.*
    FROM p LEFT JOIN LATERAL (
      -- „c” od ostatniej wizyty do dziś, „p” tyle samo dni bezpośrednio wcześniej
      SELECT
        AVG(s.pain) FILTER (WHERE s.day >= p.since)::float8 AS pain_c, COUNT(s.pain) FILTER (WHERE s.day >= p.since)::int AS pain_cn,
        AVG(s.pain) FILTER (WHERE s.day < p.since)::float8 AS pain_p, COUNT(s.pain) FILTER (WHERE s.day < p.since)::int AS pain_pn,
        AVG(s.sleep) FILTER (WHERE s.day >= p.since)::float8 AS sleep_c, COUNT(s.sleep) FILTER (WHERE s.day >= p.since)::int AS sleep_cn,
        AVG(s.sleep) FILTER (WHERE s.day < p.since)::float8 AS sleep_p, COUNT(s.sleep) FILTER (WHERE s.day < p.since)::int AS sleep_pn,
        AVG(s.anxiety) FILTER (WHERE s.day >= p.since)::float8 AS anxiety_c, COUNT(s.anxiety) FILTER (WHERE s.day >= p.since)::int AS anxiety_cn,
        AVG(s.anxiety) FILTER (WHERE s.day < p.since)::float8 AS anxiety_p, COUNT(s.anxiety) FILTER (WHERE s.day < p.since)::int AS anxiety_pn,
        AVG(s.mood) FILTER (WHERE s.day >= p.since)::float8 AS mood_c, COUNT(s.mood) FILTER (WHERE s.day >= p.since)::int AS mood_cn,
        AVG(s.mood) FILTER (WHERE s.day < p.since)::float8 AS mood_p, COUNT(s.mood) FILTER (WHERE s.day < p.since)::int AS mood_pn
      FROM symptom_log s
      WHERE s.user_id = ${u} AND s.day BETWEEN p.since - (p.d - p.since + 1) AND p.d
    ) a ON true
    WHERE p.next IS NOT NULL`;
  if (!r) return null;
  // własne pomiary (POM-63) w tym samym okresie: ostatnia wartość i zmiana od pierwszego pomiaru w okresie (bez norm i ocen)
  const ms = await sql()`SELECT d.name, d.unit, COUNT(*)::int AS n,
      (array_agg(v.value::float8 ORDER BY v.day))[1] AS first, (array_agg(v.value::float8 ORDER BY v.day DESC))[1] AS last
    FROM measure_defs d JOIN measure_values v ON v.def_id = d.id
    WHERE d.user_id = ${u} AND v.day BETWEEN ${r.since}::date AND ${r.today}::date
    GROUP BY d.id, d.slot, d.name, d.unit ORDER BY d.slot`;
  return {
    measures: ms.map((m) => ({ name: m.name, unit: m.unit, last: m.last, n: m.n, diff: m.n >= 2 ? Math.round((m.last - m.first) * 100) / 100 : null })),
    next: r.next, daysTo: r.days_to, last: r.last, since: r.since, today: r.today,
    notes: r.notes, days: r.days, trends: weekTrends(r),
    // raport i „Do omówienia” są w planie Premium (lib/plans.js): bez niego karta pokazuje samo podsumowanie
    report: canUse({ plan: r.plan, plan_until: r.plan_until }, 'doctor_report'),
  };
}
