import { ensureDb, sql } from './db';
import { weekTrends } from './week-calc';

// UI 5 etap 5: jedno zapytanie dla karty „Twój tydzień”: średnie objawów z 7 ostatnich dni i 7 wcześniejszych
// (dzień polski) oraz liczby recept i wizyt do odznak. Tylko dane właściciela (userId z sesji), bez zużycia.
export async function weekSummary(userId, now = new Date()) {
  await ensureDb();
  const u = Number(userId) || 0;
  const [r] = await sql()`WITH t AS (SELECT (${new Date(now).toISOString()}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date AS d)
    SELECT
      AVG(s.pain) FILTER (WHERE s.day > t.d - 7)::float8 AS pain_c, COUNT(s.pain) FILTER (WHERE s.day > t.d - 7)::int AS pain_cn,
      AVG(s.pain) FILTER (WHERE s.day <= t.d - 7)::float8 AS pain_p, COUNT(s.pain) FILTER (WHERE s.day <= t.d - 7)::int AS pain_pn,
      AVG(s.sleep) FILTER (WHERE s.day > t.d - 7)::float8 AS sleep_c, COUNT(s.sleep) FILTER (WHERE s.day > t.d - 7)::int AS sleep_cn,
      AVG(s.sleep) FILTER (WHERE s.day <= t.d - 7)::float8 AS sleep_p, COUNT(s.sleep) FILTER (WHERE s.day <= t.d - 7)::int AS sleep_pn,
      AVG(s.anxiety) FILTER (WHERE s.day > t.d - 7)::float8 AS anxiety_c, COUNT(s.anxiety) FILTER (WHERE s.day > t.d - 7)::int AS anxiety_cn,
      AVG(s.anxiety) FILTER (WHERE s.day <= t.d - 7)::float8 AS anxiety_p, COUNT(s.anxiety) FILTER (WHERE s.day <= t.d - 7)::int AS anxiety_pn,
      AVG(s.mood) FILTER (WHERE s.day > t.d - 7)::float8 AS mood_c, COUNT(s.mood) FILTER (WHERE s.day > t.d - 7)::int AS mood_cn,
      AVG(s.mood) FILTER (WHERE s.day <= t.d - 7)::float8 AS mood_p, COUNT(s.mood) FILTER (WHERE s.day <= t.d - 7)::int AS mood_pn,
      (SELECT COUNT(*) FROM prescriptions WHERE user_id = ${u})::int AS rx,
      (SELECT COUNT(*) FROM visits WHERE user_id = ${u})::int AS visits
    FROM t LEFT JOIN symptom_log s ON s.user_id = ${u} AND s.day BETWEEN t.d - 13 AND t.d
    GROUP BY t.d`;
  return { trends: weekTrends(r), rx: r.rx, visits: r.visits };
}
