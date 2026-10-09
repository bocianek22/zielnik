// Porównanie okresów w Historii („Mój miesiąc”, POM-42): ostatnie 30 albo 90 dni a tyle samo dni bezpośrednio wcześniej.
// Okna mają równą długość (miesiąc kalendarzowy do dziś kontra pełny poprzedni dałby w pierwszych dniach miesiąca zawsze „mniej”).
// Tylko własne dane użytkownika, dzień w czasie polskim; g (susz) i ml (olej, pen) nigdy się nie sumują.
import { ensureDb, sql } from './db';
import { todayPL, addDaysIso } from './date';
import { SYMPTOMS } from './symptoms';

export const PERIOD_DAYS = { month: 30, quarter: 90 };

// Okno [from, to] włącznie, dni „RRRR-MM-DD”; `back` okien wstecz od dziś (0 = bieżące, 1 = poprzednie)
export function periodWindow(today, days, back = 0) {
  const to = addDaysIso(today, -days * back);
  return { from: addDaysIso(to, -(days - 1)), to };
}

async function windowStats(userId, { from, to }) {
  const q = sql();
  // granice północą polską na surowej kolumnie (korzysta z usage_log_user_idx): dzień `to` wchodzi w całości
  const [u] = await q`
    SELECT COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 AS grams,
           COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 AS ml,
           COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)::int AS active_days
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId}
      AND l.created_at >= (${from}::date::timestamp AT TIME ZONE 'Europe/Warsaw')
      AND l.created_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Warsaw')`;
  const [b] = await q`
    SELECT COALESCE(SUM(grams) FILTER (WHERE strain_unit(strain_id) = 'g'), 0)::float8 AS grams,
           COALESCE(SUM(grams) FILTER (WHERE strain_unit(strain_id) = 'ml'), 0)::float8 AS ml
    FROM purchases
    WHERE user_id = ${userId}
      AND created_at >= (${from}::date::timestamp AT TIME ZONE 'Europe/Warsaw')
      AND created_at < ((${to}::date + 1)::timestamp AT TIME ZONE 'Europe/Warsaw')`;
  const [y] = await q`
    SELECT AVG(pain)::float8 AS pain, COUNT(pain)::int AS n_pain, AVG(sleep)::float8 AS sleep, COUNT(sleep)::int AS n_sleep,
           AVG(anxiety)::float8 AS anxiety, COUNT(anxiety)::int AS n_anxiety, AVG(mood)::float8 AS mood, COUNT(mood)::int AS n_mood
    FROM symptom_log WHERE user_id = ${userId} AND day BETWEEN ${from}::date AND ${to}::date`;
  return {
    from, to, grams: u.grams, ml: u.ml, activeDays: u.active_days, boughtGrams: b.grams, boughtMl: b.ml,
    symptoms: Object.fromEntries(SYMPTOMS.map((s) => [s.key, { avg: y[`n_${s.key}`] > 0 ? y[s.key] : null, n: y[`n_${s.key}`] }])),
  };
}

// { month: { cur, prev }, quarter: { cur, prev } }; `today` do testów granic
export async function periodCompare(userId, { today = todayPL() } = {}) {
  await ensureDb();
  const out = {};
  await Promise.all(Object.entries(PERIOD_DAYS).map(async ([key, days]) => {
    const [cur, prev] = await Promise.all([0, 1].map((back) => windowStats(userId, periodWindow(today, days, back))));
    out[key] = { cur, prev };
  }));
  return out;
}
