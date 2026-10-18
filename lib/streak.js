import { ensureDb, sql } from './db';
import { buildStreak } from './streak-calc';

// POM-08 „Nawyki bez presji”: ile kolejnych dni z wpisem objawów i które z ostatnich 7 dni mają wpis.
// Tylko dziennik objawów (nigdy zużycie, POM-R1), tylko dane właściciela (userId z sesji). Dzień w czasie polskim.
// Zasady: brak dzisiejszego wpisu nie zeruje serii (liczymy do wczoraj, dzień jeszcze trwa); nie ma komunikatu o „zerwaniu”
// ani powiadomień. Odznaki za regularność (UI 5 etap 5, decyzja właściciela w docs/UI-5.md) liczymy z tych samych dni
// (best, total), więc obejmują okno STREAK_LOOKBACK. Wpis = co najmniej jedna wartość (wbudowany lub własny objaw);
// sama notatka nie liczy się.
export const STREAK_LOOKBACK = 400;
// Jedno lekkie zapytanie: dni z wpisem z ostatnich STREAK_LOOKBACK dni + dzień polski „dziś”.
// `now` pozwala sprawdzić granicę północy w testach (domyślnie bieżący czas).
export async function symptomStreak(userId, now = new Date()) {
  await ensureDb();
  const u = Number(userId) || 0;
  const rows = await sql()`WITH t AS (SELECT (${new Date(now).toISOString()}::timestamptz AT TIME ZONE 'Europe/Warsaw')::date AS d)
    SELECT to_char(t.d, 'YYYY-MM-DD') AS today, to_char(e.day, 'YYYY-MM-DD') AS day
    FROM t LEFT JOIN (
      SELECT day FROM symptom_log WHERE user_id = ${u}
        AND (pain IS NOT NULL OR sleep IS NOT NULL OR anxiety IS NOT NULL OR mood IS NOT NULL)
      UNION
      SELECT day FROM symptom_values WHERE user_id = ${u}
    ) e ON e.day BETWEEN t.d - ${STREAK_LOOKBACK}::int AND t.d`;
  return buildStreak(rows.map((r) => r.day).filter(Boolean), rows[0].today);
}
