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

// Lekkie dane panelu „Dziś” zamiast pełnej listy odmian (POM-23): zapas (suma moich stanów) i „do wykupienia” osobno
// dla g i ml, liczba odmian w zielniku oraz ostatnio używane odmiany z moim stanem (do szybkiego „Zużyłem”).
// Jedno zapytanie; „do wykupienia” liczone raz na pulę (najnowsza odmiana puli), jak na liście.
export async function homeSummary(userId, recentLimit = 5) {
  await ensureDb();
  const [r] = await sql()`
    SELECT
      (SELECT COUNT(*)::int FROM strains) AS count,
      COALESCE((SELECT json_object_agg(t.unit, t.v) FROM (
        SELECT form_unit(s.form) AS unit, SUM(o.current_amount)::float8 AS v
        FROM user_strain o JOIN strains s ON s.id = o.strain_id WHERE o.user_id = ${userId} GROUP BY 1) t), '{}'::json) AS stock,
      COALESCE((SELECT json_object_agg(t.unit, t.v) FROM (
        SELECT p.unit, SUM(p.v)::float8 AS v FROM (
          SELECT DISTINCT ON (pool_key(s.id, s.producer, s.thc, s.cbd, s.form)) form_unit(s.form) AS unit, up.remaining_to_buy AS v
          FROM strains s JOIN user_pool up ON up.user_id = ${userId} AND up.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd, s.form)
          ORDER BY pool_key(s.id, s.producer, s.thc, s.cbd, s.form), s.created_at DESC, s.id DESC) p
        GROUP BY 1) t), '{}'::json) AS remaining,
      COALESCE((SELECT json_agg(json_build_object('id', x.id, 'name', x.name, 'form', x.form, 'current', x.cur) ORDER BY x.last DESC) FROM (
        SELECT s.id, s.name, s.form, COALESCE(o.current_amount, 0)::float8 AS cur, g.last
        FROM (SELECT strain_id, MAX(created_at) AS last FROM usage_log WHERE user_id = ${userId}
              GROUP BY strain_id ORDER BY MAX(created_at) DESC LIMIT ${Math.max(1, Math.min(Number(recentLimit) || 5, 20))}) g
        JOIN strains s ON s.id = g.strain_id
        LEFT JOIN user_strain o ON o.strain_id = s.id AND o.user_id = ${userId}) x), '[]'::json) AS recent`;
  return {
    count: r.count,
    stock: { g: Number(r.stock.g) || 0, ml: Number(r.stock.ml) || 0 },
    remaining: { g: Number(r.remaining.g) || 0, ml: Number(r.remaining.ml) || 0 },
    recent: r.recent,
  };
}

// Karta „W aptece” (POM-37): pule z czymś „do wykupienia”, po jednej pozycji na pulę (najnowsza odmiana puli, jak
// na liście), z nazwami pozostałych odmian puli i moim stanem. Bez cen i bez aptek (POM-R4).
export async function pharmacyPools(userId) {
  await ensureDb();
  return sql()`
    WITH s AS (SELECT s.*, pool_key(s.id, s.producer, s.thc, s.cbd, s.form) AS pk FROM strains s),
    pools AS (
      SELECT DISTINCT ON (s.pk) s.pk, s.id, s.name, s.form, form_unit(s.form) AS unit, up.remaining_to_buy::float8 AS remaining
      FROM s JOIN user_pool up ON up.user_id = ${userId} AND up.pool_key = s.pk
      WHERE up.remaining_to_buy > 0
      ORDER BY s.pk, s.created_at DESC, s.id DESC)
    SELECT p.id, p.name, p.form, p.unit, p.remaining,
      COALESCE((SELECT current_amount FROM user_strain WHERE user_id = ${userId} AND strain_id = p.id), 0)::float8 AS current,
      COALESCE((SELECT array_agg(o.name ORDER BY o.name) FROM s o WHERE o.pk = p.pk AND o.id <> p.id), '{}') AS mates
    FROM pools p ORDER BY p.unit, p.name`;
}
