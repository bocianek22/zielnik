import { ensureDb, sql } from './db';
import { SYMPTOMS } from './symptoms';
import { listCustom } from './symptoms-custom';
import { MIN_DAYS, normPeriod } from './observations';

// Czynniki dnia w „Moich obserwacjach” (POM-47): dla każdego czynnika średnie objawów w dniach z nim i bez niego.
// Zasady jak w lib/observations.js: tylko właściciel, dzień polski, sen z dnia D zestawiamy z czynnikiem z dnia D-1
// (np. kofeina wieczorem), średnia od MIN_DAYS dni w grupie. „Bez czynnika” liczymy od pierwszego zaznaczenia
// jakiegokolwiek czynnika (wcześniej nikt nie zaznaczał, więc brak znacznika nic nie znaczy). Bez rankingu „co pomaga”.
const round1 = (n) => Math.round(n * 10) / 10;

export async function factorObservations(userId, period) {
  await ensureDb();
  const q = sql();
  const u = Number(userId) || 0;
  const days = normPeriod(period);
  const [rows, factors, custom] = await Promise.all([
    q`WITH today AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d),
      win AS (SELECT d - ${days - 1}::int AS s, d AS e FROM today),
      first AS (SELECT MIN(day) AS f FROM day_factor_marks WHERE user_id = ${u}),
      pairs AS (
        SELECT k.key, k.val, CASE WHEN k.key = 'sleep' THEN s.day - 1 ELSE s.day END AS ref
        FROM symptom_log s, win,
          LATERAL (VALUES ('pain', s.pain), ('sleep', s.sleep), ('anxiety', s.anxiety), ('mood', s.mood)) AS k(key, val)
        WHERE s.user_id = ${u} AND s.day BETWEEN win.s AND win.e AND k.val IS NOT NULL
        UNION ALL
        SELECT 'c' || v.custom_id::text, v.value, v.day FROM symptom_values v, win
        WHERE v.user_id = ${u} AND v.day BETWEEN win.s AND win.e
      )
      SELECT p.key, f.id AS fid, (m.day IS NOT NULL) AS has, COUNT(*)::int AS days, AVG(p.val)::float8 AS avg
      FROM pairs p CROSS JOIN first JOIN day_factors f ON f.user_id = ${u}
      LEFT JOIN day_factor_marks m ON m.factor_id = f.id AND m.day = p.ref
      WHERE first.f IS NOT NULL AND p.ref >= first.f
      GROUP BY 1, 2, 3`,
    q`SELECT id, name FROM day_factors WHERE user_id = ${u} ORDER BY slot`,
    listCustom(u),
  ]);
  const meta = [...SYMPTOMS.map((s) => ({ key: s.key, label: s.label })), ...custom.map((d) => ({ key: `c${d.id}`, label: d.name, custom: true }))];
  const cell = (r) => (r && r.days >= MIN_DAYS ? { days: r.days, avg: round1(r.avg) } : { days: r ? r.days : 0, avg: null });
  return {
    period: days,
    minDays: MIN_DAYS,
    factors: factors.map((f) => ({
      id: f.id,
      name: f.name,
      rows: meta.map((m) => ({
        ...m,
        with: cell(rows.find((r) => r.fid === f.id && r.key === m.key && r.has)),
        without: cell(rows.find((r) => r.fid === f.id && r.key === m.key && !r.has)),
      })).filter((r) => r.with.days > 0),
    })),
  };
}
