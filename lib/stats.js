import { ensureDb, sql } from './db';

// Panel „Dziś” na stronie głównej. Dni liczone w czasie polskim (Europe/Warsaw), niezależnie od strefy serwera.

// Zużycie użytkownika z ostatnich `days` dni (dziś włącznie, dziś na końcu); dni bez wpisów mają 0.
// grams: susz, ml: olej i pen (osobno, bez sumowania jednostek).
// Zakres na created_at (a nie wyrażenie na każdym wierszu), żeby działał indeks usage_log_user_idx.
export async function dailyUsageSeries(userId, days = 14) {
  await ensureDb();
  const n = Math.max(1, Math.min(Number(days) || 14, 90));
  return sql()`
    WITH b AS (SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS today),
    l AS (
      SELECT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date AS day,
             SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g') AS grams, SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml') AS ml
      FROM usage_log l JOIN strains s ON s.id = l.strain_id, b
      WHERE l.user_id = ${userId} AND l.created_at >= ((b.today - ${n - 1}::int)::timestamp AT TIME ZONE 'Europe/Warsaw')
      GROUP BY 1
    )
    SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(l.grams, 0)::float8 AS grams, COALESCE(l.ml, 0)::float8 AS ml
    FROM b, generate_series(b.today - ${n - 1}::int, b.today, interval '1 day') d
    LEFT JOIN l ON l.day = d::date
    ORDER BY d`;
}

// Dzisiejszy (czas polski) wpis objawów do szybkiego wpisu w panelu; z notatką, bo PUT /api/symptoms nadpisuje cały wiersz
export async function todaySymptoms(userId) {
  await ensureDb();
  const q = sql();
  const [[row], defs] = await Promise.all([
    q`SELECT pain, sleep, anxiety, mood, note FROM symptom_log
      WHERE user_id = ${userId} AND day = (now() AT TIME ZONE 'Europe/Warsaw')::date`,
    // własne objawy (POM-07) z dzisiejszą wartością: jedno małe zapytanie, bez własnych objawów brak zmian w wyniku
    q`SELECT c.id, c.slot, c.name, c.higher_better, v.value FROM symptom_custom c
      LEFT JOIN symptom_values v ON v.custom_id = c.id AND v.day = (now() AT TIME ZONE 'Europe/Warsaw')::date
      WHERE c.user_id = ${userId} ORDER BY c.slot`,
  ]);
  if (!defs.length) return row ?? null;
  return {
    pain: null, sleep: null, anxiety: null, mood: null, note: '', ...row,
    defs: defs.map((d) => ({ id: d.id, slot: d.slot, name: d.name, higherBetter: d.higher_better })),
    custom: Object.fromEntries(defs.filter((d) => d.value != null).map((d) => [d.id, d.value])),
  };
}

// Ostatnio używane odmiany (bez powtórzeń, najnowsze pierwsze): do szybkiego „Zużyłem” w panelu
export async function recentStrainIds(userId, limit = 5) {
  await ensureDb();
  const rows = await sql()`
    SELECT strain_id FROM usage_log WHERE user_id = ${userId}
    GROUP BY strain_id ORDER BY MAX(created_at) DESC LIMIT ${Math.max(1, Math.min(Number(limit) || 5, 20))}`;
  return rows.map((r) => r.strain_id);
}

// Recepty z terminem, z których zostało coś do wykupienia: ważne (odliczanie do końca ważności)
// i wygasłe z niewykorzystanymi gramami, te ostatnie najwyżej EXPIRED_DAYS dni wstecz (starsze tylko w `total`).
// Wykup liczony jak w prescriptionAlerts (lib/strains.js). Pilna = wygasa w ≤ 7 dni albo już wygasła.
export const EXPIRED_DAYS = 60;
export async function prescriptionCountdown(userId) {
  await ensureDb();
  const rows = await sql()`
    SELECT p.id, p.grams::float8 AS grams, p.unit,
           COALESCE((SELECT SUM(pu.grams) FROM purchases pu WHERE pu.user_id = p.user_id AND strain_unit(pu.strain_id) = p.unit
             AND (pu.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN p.issued_on AND p.valid_until), 0)::float8 AS bought,
           to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
           (p.valid_until - (now() AT TIME ZONE 'Europe/Warsaw')::date)::int AS days_left
    FROM prescriptions p WHERE p.user_id = ${userId} AND p.valid_until IS NOT NULL`;
  const open = rows.map((r) => ({ ...r, remaining: Math.max(r.grams - r.bought, 0) })).filter((r) => r.remaining > 0);
  const items = open
    .filter((r) => r.days_left >= -EXPIRED_DAYS)
    .map((r) => ({ ...r, urgent: r.days_left <= 7 }))
    // najpierw ważne (najbliższy termin), potem wygasłe (najświeższe)
    .sort((a, b) => (a.days_left < 0) - (b.days_left < 0) || (a.days_left < 0 ? b.days_left - a.days_left : a.days_left - b.days_left));
  return { items, total: open.length, urgent: items.some((r) => r.urgent) };
}
