import { ensureDb, sql } from './db';
import { SYMPTOMS } from './symptoms';
import { normUnit } from './units';

// „Moje obserwacje” (POM-06): opisowe średnie objawów w dniach z daną odmianą. Tylko dane właściciela (userId z sesji).
// Zasady (docs/POMYSLY.md):
//  - grupy są rozłączne dla każdego objawu: dni z jedną odmianą (wiersz na odmianę), dni z kilkoma odmianami,
//    dni bez zużycia; nie ma „dni bez odmiany X”, bo mieszałoby to inne odmiany z dniami bez zużycia;
//  - sen dotyczy ostatniej nocy, więc sen z dnia D porównujemy z zużyciem z dnia D-1; pozostałe objawy z dniem D;
//  - „bez zużycia” liczymy dopiero od pierwszego wpisu zużycia (wcześniejsze dni to brak dziennika, a nie przerwa);
//  - średnia dopiero od MIN_DAYS dni w grupie, poniżej tylko liczba dni (średnia nie opuszcza serwera);
//  - ilości osobno w jednostce odmiany (g / ml), w grupie mieszanej g i ml osobno; bez ilości na dzień obok średniej
//    (to byłby trend dawka-objaw), kolejność wierszy według liczby dni, nigdy według średniej.
// Dni w czasie polskim, jak w lib/strain-stats.js.
export const MIN_DAYS = 5;
export const PERIODS = [30, 90, 180, 365];
export const DEFAULT_PERIOD = 90;
export const normPeriod = (v) => (PERIODS.includes(Number(v)) ? Number(v) : DEFAULT_PERIOD);

const KEYS = SYMPTOMS.map((s) => s.key);
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

export async function observations(userId, period = DEFAULT_PERIOD) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const days = normPeriod(period);
  // okno objawów: ostatnie `days` dni łącznie z dziś; zużycie o dzień wcześniej (sen z pierwszego dnia okna)
  const [rows, strains, [meta]] = await Promise.all([
    q`WITH today AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d),
      win AS (SELECT d - ${days - 1}::int AS s, d AS e FROM today),
      use AS (
        SELECT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date AS d, l.strain_id
        FROM usage_log l, win
        WHERE l.user_id = ${u} AND l.grams > 0
          AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN win.s - 1 AND win.e
        GROUP BY 1, 2
      ),
      dayuse AS (SELECT d, COUNT(*)::int AS n, MIN(strain_id) AS sid FROM use GROUP BY d),
      first AS (SELECT MIN((created_at AT TIME ZONE 'Europe/Warsaw')::date) AS f FROM usage_log WHERE user_id = ${u} AND grams > 0),
      pairs AS (
        SELECT k.key, k.val, CASE WHEN k.key = 'sleep' THEN s.day - 1 ELSE s.day END AS ref
        FROM symptom_log s, win,
          LATERAL (VALUES ('pain', s.pain), ('sleep', s.sleep), ('anxiety', s.anxiety), ('mood', s.mood)) AS k(key, val)
        WHERE s.user_id = ${u} AND s.day BETWEEN win.s AND win.e AND k.val IS NOT NULL
      )
      SELECT p.key,
        CASE WHEN du.n IS NULL THEN 'none' WHEN du.n > 1 THEN 'mixed' ELSE 'strain' END AS grp,
        CASE WHEN du.n = 1 THEN du.sid END AS sid,
        COUNT(*)::int AS days, AVG(p.val)::float8 AS avg
      FROM pairs p CROSS JOIN first LEFT JOIN dayuse du ON du.d = p.ref
      WHERE first.f IS NOT NULL AND p.ref >= first.f
      GROUP BY 1, 2, 3`,
    // odmiany z okna zużycia (z dniem przed oknem, dla nazw w grupach snu); ilość i liczba dni (w tym dni mieszane)
    // tylko z samego okresu, żeby „90 dni” znaczyło 90 dni
    q`WITH today AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d)
      SELECT l.strain_id AS id, s.name, form_unit(s.form) AS unit,
        COALESCE(SUM(l.grams) FILTER (WHERE (l.created_at AT TIME ZONE 'Europe/Warsaw')::date >= today.d - ${days - 1}::int), 0)::float8 AS total,
        COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)
          FILTER (WHERE (l.created_at AT TIME ZONE 'Europe/Warsaw')::date >= today.d - ${days - 1}::int)::int AS use_days
      FROM usage_log l JOIN strains s ON s.id = l.strain_id, today
      WHERE l.user_id = ${u} AND l.grams > 0
        AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN today.d - ${days}::int AND today.d
      GROUP BY l.strain_id, s.name, s.form`,
    q`WITH today AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d),
      md AS (
        SELECT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date AS d
        FROM usage_log l, today
        WHERE l.user_id = ${u} AND l.grams > 0
          AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN today.d - ${days - 1}::int AND today.d
        GROUP BY 1 HAVING COUNT(DISTINCT l.strain_id) > 1
      )
      SELECT
        (SELECT COUNT(*)::int FROM symptom_log, today WHERE user_id = ${u} AND day BETWEEN today.d - ${days - 1}::int AND today.d) AS entries,
        (SELECT to_char(MIN((created_at AT TIME ZONE 'Europe/Warsaw')::date), 'YYYY-MM-DD') FROM usage_log WHERE user_id = ${u} AND grams > 0) AS first_use,
        (SELECT COUNT(*)::int FROM md) AS mixed_days,
        (SELECT COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 FROM usage_log l JOIN strains s ON s.id = l.strain_id
          WHERE l.user_id = ${u} AND l.grams > 0 AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date IN (SELECT d FROM md)) AS mixed_g,
        (SELECT COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 FROM usage_log l JOIN strains s ON s.id = l.strain_id
          WHERE l.user_id = ${u} AND l.grams > 0 AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date IN (SELECT d FROM md)) AS mixed_ml`,
  ]);

  const info = Object.fromEntries(strains.map((s) => [s.id, s]));
  const cell = (r) => (r && r.days >= MIN_DAYS ? { days: r.days, avg: round1(r.avg) } : { days: r ? r.days : 0, avg: null });
  const symptoms = {};
  for (const k of KEYS) {
    const mine = rows.filter((r) => r.key === k);
    const groups = mine.filter((r) => r.grp === 'strain' && info[r.sid])
      .map((r) => ({ id: r.sid, name: info[r.sid].name, unit: normUnit(info[r.sid].unit), ...cell(r) }))
      .sort((a, b) => b.days - a.days || a.name.localeCompare(b.name, 'pl'));
    symptoms[k] = {
      strains: groups,
      mixed: cell(mine.find((r) => r.grp === 'mixed')),
      none: cell(mine.find((r) => r.grp === 'none')),
      days: mine.reduce((a, r) => a + r.days, 0),
    };
  }
  return {
    period: days,
    minDays: MIN_DAYS,
    entries: meta.entries,
    firstUse: meta.first_use,
    symptoms,
    // ilości w jednostce odmiany (bez średniej na dzień); dni mieszane: g i ml osobno
    strains: strains.filter((s) => s.use_days > 0).map((s) => ({ id: s.id, name: s.name, unit: normUnit(s.unit), total: round2(s.total), useDays: s.use_days }))
      .sort((a, b) => b.useDays - a.useDays || a.name.localeCompare(b.name, 'pl')),
    mixed: { days: meta.mixed_days, g: round2(meta.mixed_g), ml: round2(meta.mixed_ml) },
  };
}
