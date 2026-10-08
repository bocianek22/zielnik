import { sql } from './db';

// Zbiorcze wskaźniki bety dla panelu admina. Tylko liczby zbiorcze, bez identyfikatorów kont; konta admina nie liczą się
// ani do licznika, ani do mianownika. Ochrona przed identyfikacją: grupa mniejsza niż MIN_GROUP kont = wartości null
// (decyzja zapada tu, na serwerze, więc mała grupa nie wychodzi do przeglądarki).
export const MIN_GROUP = 5;
const WINDOW_DAYS = 7;

// - active7: konta (bez admina) z sesją użytą w ostatnich 7 dniach; grupa = wszystkie konta bez admina
// - kohorta: konta zarejestrowane co najmniej 7 dni temu (pełne okno obserwacji); odsetek kont, które w pierwszych 7 dniach
//   od rejestracji miały: odmianę (wpis osobisty albo własną odmianę), receptę, zapis zużycia. Wpis osobisty datuje updated_at,
//   więc edycja po upływie okna wypycha go z liczby (lekkie niedoszacowanie).
export async function betaMetrics() {
  const [a] = await sql()`SELECT
    (SELECT count(*)::int FROM users WHERE NOT is_admin) AS accounts,
    (SELECT count(DISTINCT s.user_id)::int FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE NOT u.is_admin AND s.revoked_at IS NULL AND s.last_used_at > now() - make_interval(days => ${WINDOW_DAYS}::int)) AS active7`;
  const [c] = await sql()`WITH c AS (SELECT id, created_at + make_interval(days => ${WINDOW_DAYS}::int) AS until FROM users
                                      WHERE NOT is_admin AND created_at <= now() - make_interval(days => ${WINDOW_DAYS}::int))
    SELECT count(*)::int AS cohort,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM user_strain x WHERE x.user_id = c.id AND x.updated_at <= c.until)
                          OR EXISTS (SELECT 1 FROM strains x WHERE x.created_by = c.id AND x.created_at <= c.until))::int AS strain,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM prescriptions x WHERE x.user_id = c.id AND x.created_at <= c.until))::int AS rx,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM usage_log x WHERE x.user_id = c.id AND x.created_at <= c.until))::int AS usage
    FROM c`;
  const pct = (n) => Math.round((n / c.cohort) * 100);
  const ok = c.cohort >= MIN_GROUP;
  return {
    minGroup: MIN_GROUP,
    active7: a.accounts >= MIN_GROUP ? a.active7 : null,
    cohort: ok ? c.cohort : null,
    pctStrain: ok ? pct(c.strain) : null,
    pctPrescription: ok ? pct(c.rx) : null,
    pctUsage: ok ? pct(c.usage) : null,
  };
}
