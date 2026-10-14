import { sql } from './db';

// Znaczniki zdarzeń na wykresie objawów (POM-53): dni wizyt (POM-52) i zakupów (z nową partią, POM-32) z ostatnich
// `days` dni. Tylko daty i rodzaj, bez notatek, ilości i nazw; tylko dane właściciela, dzień w czasie polskim.
// Zwraca [{ day, visit, purchase, batch }] posortowane po dniu.
export async function dayEvents(userId, days = 60) {
  const q = sql();
  const u = Number(userId) || 0;
  const rows = await q`WITH from_d AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date - ${days}::int AS d),
      ev AS (
        SELECT v.day, 'visit' AS kind FROM visits v, from_d WHERE v.user_id = ${u} AND v.day >= from_d.d
          AND v.day <= (now() AT TIME ZONE 'Europe/Warsaw')::date
        UNION ALL
        SELECT (p.created_at AT TIME ZONE 'Europe/Warsaw')::date, CASE WHEN p.batch_no <> '' THEN 'batch' ELSE 'purchase' END
        FROM purchases p, from_d WHERE p.user_id = ${u} AND (p.created_at AT TIME ZONE 'Europe/Warsaw')::date >= from_d.d
      )
      SELECT to_char(day, 'YYYY-MM-DD') AS day, bool_or(kind = 'visit') AS visit,
        bool_or(kind IN ('purchase', 'batch')) AS purchase, bool_or(kind = 'batch') AS batch
      FROM ev GROUP BY day ORDER BY day`;
  return rows;
}
