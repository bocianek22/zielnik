import { ensureDb, sql } from './db';
import { sumByUnit } from './units';
import { openRows } from './data-crypto';

// Poniżej tylu dni z wpisem nie pokazujemy średniej objawu przy odmianie (zasada z POM-06)
export const MIN_SYMPTOM_DAYS = 5;

// Stan recepty na koniec okresu: wykupiona w całości, ważna (zostało do wykupienia) albo wygasła z resztą
export function rxStatus(r, to) {
  const remaining = Math.max(Number(r.grams) - Number(r.bought), 0);
  const status = remaining <= 0 ? 'used' : r.valid_until && r.valid_until < to ? 'expired' : 'valid';
  return { ...r, remaining, status };
}

// Podsumowanie recept w okresie: ile wystawiono, ile ważnych na koniec okresu, ilości osobno w g i ml
export function rxSummary(items, from, to) {
  const pick = (f, key) => sumByUnit(items.filter(f), key);
  return {
    issued: items.filter((r) => r.issued_on >= from).length,
    valid: items.filter((r) => !r.valid_until || r.valid_until >= to).length,
    prescribed: pick(() => true, 'grams'),
    bought: pick(() => true, 'bought'),
    left: pick((r) => r.status === 'valid', 'remaining'),
    unused: pick((r) => r.status === 'expired', 'remaining'),
  };
}

// Dane raportu dla lekarza z okresu from..to (dni „RRRR-MM-DD” w czasie polskim, włącznie). Ilości w jednostce
// odmiany: susz w gramach, olej i pen w ml; sumy zawsze osobno dla każdej jednostki, nigdy razem.
export async function doctorReport(userId, from, to) {
  await ensureDb();
  const q = sql();
  const [usage, weekly, purchases, feel, [sym], rxRows, strainSym, when, customSym] = await Promise.all([
    q`SELECT s.name, s.producer, s.thc::float8 AS thc, s.cbd::float8 AS cbd, form_unit(s.form) AS unit, SUM(l.grams)::float8 AS grams,
        COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)::int AS days
      FROM usage_log l JOIN strains s ON s.id = l.strain_id
      WHERE l.user_id = ${userId} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY s.id ORDER BY form_unit(s.form), grams DESC`,
    // Tydzień po tygodniu (od poniedziałku), każdy tydzień okresu także bez wpisów; pierwszy i ostatni przycięte do okresu.
    // Rachunek na samych datach, bez date_trunc na znaczniku czasu (wynik nie zależy od strefy sesji bazy).
    q`WITH b AS (SELECT ${from}::date AS f, ${to}::date AS t),
      w AS (SELECT (b.f - (EXTRACT(ISODOW FROM b.f)::int - 1)) + 7 * i AS ws, b.f, b.t
        FROM b, generate_series(0, ((b.t - (b.f - (EXTRACT(ISODOW FROM b.f)::int - 1))) / 7)) i),
      u AS (SELECT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date AS d, form_unit(s.form) AS unit, l.grams
        FROM usage_log l JOIN strains s ON s.id = l.strain_id, b
        WHERE l.user_id = ${userId} AND (l.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN b.f AND b.t),
      p AS (SELECT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d, strain_unit(strain_id) AS unit, grams
        FROM purchases, b WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN b.f AND b.t),
      y AS (SELECT day AS d, pain, sleep, anxiety, mood, note FROM symptom_log, b WHERE user_id = ${userId} AND day BETWEEN b.f AND b.t)
      SELECT to_char(GREATEST(w.ws, w.f), 'YYYY-MM-DD') AS start, to_char(LEAST(w.ws + 6, w.t), 'YYYY-MM-DD') AS "end",
        (SELECT COALESCE(SUM(grams) FILTER (WHERE unit = 'g'), 0)::float8 FROM u WHERE d BETWEEN w.ws AND w.ws + 6) AS used_g,
        (SELECT COALESCE(SUM(grams) FILTER (WHERE unit = 'ml'), 0)::float8 FROM u WHERE d BETWEEN w.ws AND w.ws + 6) AS used_ml,
        (SELECT COUNT(DISTINCT d)::int FROM u WHERE d BETWEEN w.ws AND w.ws + 6) AS use_days,
        (SELECT COALESCE(SUM(grams) FILTER (WHERE unit = 'g'), 0)::float8 FROM p WHERE d BETWEEN w.ws AND w.ws + 6) AS bought_g,
        (SELECT COALESCE(SUM(grams) FILTER (WHERE unit = 'ml'), 0)::float8 FROM p WHERE d BETWEEN w.ws AND w.ws + 6) AS bought_ml,
        ys.days AS sym_days, ys.pain, ys.sleep, ys.anxiety, ys.mood
      FROM w CROSS JOIN LATERAL (SELECT COUNT(*) FILTER (WHERE pain IS NOT NULL OR sleep IS NOT NULL OR anxiety IS NOT NULL OR mood IS NOT NULL OR note <> '')::int AS days, AVG(pain)::float8 AS pain, AVG(sleep)::float8 AS sleep,
          AVG(anxiety)::float8 AS anxiety, AVG(mood)::float8 AS mood FROM y WHERE d BETWEEN w.ws AND w.ws + 6) ys
      ORDER BY w.ws`,
    q`SELECT strain_name AS name, grams::float8 AS grams, cost::float8 AS cost, strain_unit(strain_id) AS unit,
        to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS at
      FROM purchases WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date ORDER BY created_at`,
    q`SELECT s.name, us.effects, us.rating::float8 AS rating, us.notes
      FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.user_id = ${userId} AND s.id IN (SELECT strain_id FROM usage_log WHERE user_id = ${userId}
        AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date) ORDER BY s.name`,
    q`SELECT COUNT(*) FILTER (WHERE pain IS NOT NULL OR sleep IS NOT NULL OR anxiety IS NOT NULL OR mood IS NOT NULL OR note <> '')::int AS days, AVG(pain)::float8 AS pain, AVG(sleep)::float8 AS sleep, AVG(anxiety)::float8 AS anxiety, AVG(mood)::float8 AS mood
      FROM symptom_log WHERE user_id = ${userId} AND day BETWEEN ${from}::date AND ${to}::date`,
    // Recepty, których okres ważności zachodzi na raport. Wykup jak w /recepty (zakupy tej samej jednostki w okresie
    // ważności), ale tylko do końca raportu: stan „na dzień” to, a nie na dziś.
    q`SELECT p.id, to_char(p.issued_on, 'YYYY-MM-DD') AS issued_on, to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
        p.grams::float8 AS grams, p.unit,
        rx_bought(p.user_id, p.id, p.unit, p.issued_on, LEAST(p.valid_until, ${to}::date), ${to}::date)::float8 AS bought
      FROM prescriptions p
      WHERE p.user_id = ${userId} AND p.issued_on <= ${to}::date AND (p.valid_until IS NULL OR p.valid_until >= ${from}::date)
      ORDER BY p.issued_on, p.id`,
    // Objawy w dniach z odmianą (opisowo, zasady POM-06): ból, lęk i nastrój z tego samego dnia, sen z następnego
    // dnia (pytanie dotyczy „ostatniej nocy”). Dzień z kilkoma odmianami liczy się przy każdej z nich (dni mieszane).
    q`WITH ud AS (SELECT DISTINCT (created_at AT TIME ZONE 'Europe/Warsaw')::date AS d, strain_id FROM usage_log
        WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date),
      c AS (SELECT d, COUNT(*) AS n FROM ud GROUP BY d)
      SELECT s.name, s.producer, COUNT(*)::int AS days, COUNT(*) FILTER (WHERE c.n > 1)::int AS mixed,
        COUNT(y.pain)::int AS n_pain, AVG(y.pain)::float8 AS pain,
        COUNT(z.sleep)::int AS n_sleep, AVG(z.sleep)::float8 AS sleep,
        COUNT(y.anxiety)::int AS n_anxiety, AVG(y.anxiety)::float8 AS anxiety,
        COUNT(y.mood)::int AS n_mood, AVG(y.mood)::float8 AS mood
      FROM ud JOIN c USING (d) JOIN strains s ON s.id = ud.strain_id
      LEFT JOIN symptom_log y ON y.user_id = ${userId} AND y.day = ud.d
      LEFT JOIN symptom_log z ON z.user_id = ${userId} AND z.day = ud.d + 1 AND z.day <= ${to}::date
      GROUP BY s.id ORDER BY days DESC, s.name`,
    // POM-03: ile wpisów zużycia przypada na porę dnia i na sposób (liczba wpisów, bez ilości: g i ml się nie mieszają);
    // pora z zapisu albo z godziny wpisu, sposób tylko tam, gdzie go podano
    q`SELECT 'period' AS kind, usage_period(period, created_at) AS key, COUNT(*)::int AS n FROM usage_log
        WHERE user_id = ${userId} AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date GROUP BY 2
      UNION ALL
      SELECT 'method', method, COUNT(*)::int FROM usage_log
        WHERE user_id = ${userId} AND method IS NOT NULL AND (created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN ${from}::date AND ${to}::date GROUP BY 2`,
    // własne objawy pacjenta (POM-07): średnia z okresu i liczba dni z wpisem, tak samo opisowo jak wbudowane
    q`SELECT c.id, c.name, c.higher_better, COUNT(v.value)::int AS days, AVG(v.value)::float8 AS avg
      FROM symptom_custom c LEFT JOIN symptom_values v ON v.custom_id = c.id AND v.day BETWEEN ${from}::date AND ${to}::date
      WHERE c.user_id = ${userId} GROUP BY c.id ORDER BY c.slot`,
  ]);
  const rx = rxRows.map((r) => rxStatus(r, to));
  const totals = {
    used: sumByUnit(usage),
    bought: sumByUnit(purchases),
    cost: purchases.reduce((a, p) => a + (p.cost || 0), 0),
  };
  return { usage, weekly, purchases, feel: openRows(feel, 'user_strain', 'notes', userId), sym, customSym, totals, rx, rxSum: rxSummary(rx, from, to), strainSym,
    whenUsed: { period: when.filter((r) => r.kind === 'period'), method: when.filter((r) => r.kind === 'method') } };
}
