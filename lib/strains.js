import { ensureDb, sql } from './db';
import { KINDS } from './kinds';
import { FORM_VALUES } from './forms';

// Odmiany razem z wpisami użytkowników. Cudze wpisy są filtrowane wg widoczności (can_see);
// stany i "do wykupienia" widzi wyłącznie ich właściciel.
// Wiersze user_strain powstają dopiero przy pierwszym zapisie (MOB-10), więc własny wpis oglądającego jest
// zawsze dołączany (z wartościami domyślnymi, gdy wiersza jeszcze nie ma), a cudze tylko te z treścią.
// ids: opcjonalnie tylko wybrane odmiany (np. strona odmiany, porównanie).
export async function listStrains(viewerId = 0, { ids = null } = {}) {
  await ensureDb();
  const v = Number(viewerId) || 0;
  const only = Array.isArray(ids) ? ids.map(Number).filter(Number.isInteger) : null;
  return sql()`
    SELECT s.id, s.producer, s.name, s.type, s.final_rating::float8 AS final_rating, s.taste, s.created_by,
      pool_key(s.id, s.producer, s.thc, s.cbd) AS pool_key, s.price_per_g::float8 AS price_per_g, s.batch,
      to_char(s.expires_on, 'YYYY-MM-DD') AS expires_on, s.thc::float8 AS thc, s.cbd::float8 AS cbd,
      s.kind, s.terpenes, s.description, s.form, s.sources, s.description_auto,
      (SELECT floor(extract(epoch FROM p.updated_at))::int FROM strain_photos p WHERE p.strain_id = s.id) AS photo_v,
      pr.avg_price, pr.price_n,
      (SELECT COALESCE(json_agg(e.j ORDER BY e.k), '[]'::json) FROM (
        SELECT lower(me.username) AS k, json_build_object(
          'userId', me.id, 'username', me.username, 'displayName', me.display_name,
          'rating', o.rating, 'ratedAt', o.rated_at,
          'current', COALESCE(o.current_amount, 0), 'remaining', COALESCE(up.remaining_to_buy, 0),
          'notes', COALESCE(o.notes, ''), 'effects', COALESCE(o.effects, '{}'::jsonb),
          'visibility', COALESCE(o.visibility, 'me'), 'price', o.price_per_g::float8) AS j
        FROM users me
        LEFT JOIN user_strain o ON o.strain_id = s.id AND o.user_id = me.id
        LEFT JOIN user_pool up ON up.user_id = me.id AND up.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd)
        WHERE me.id = ${v}::int
        UNION ALL
        SELECT lower(u.username), json_build_object(
          'userId', x.user_id, 'username', u.username, 'displayName', u.display_name,
          'rating', x.rating, 'ratedAt', x.rated_at, 'current', NULL, 'remaining', NULL,
          'notes', x.notes, 'effects', x.effects, 'visibility', NULL, 'price', NULL)
        FROM user_strain x JOIN users u ON u.id = x.user_id
        WHERE x.strain_id = s.id AND x.user_id <> ${v}::int
          AND (x.rating IS NOT NULL OR x.notes <> '' OR x.effects <> '{}'::jsonb)
          AND can_see(${v}::int, x.user_id, x.visibility)
      ) e) AS entries
    FROM strains s
    LEFT JOIN LATERAL (
      SELECT CASE WHEN COUNT(x.price_per_g) >= 3 THEN AVG(x.price_per_g)::float8 END AS avg_price, COUNT(x.price_per_g)::int AS price_n
      FROM user_strain x WHERE x.strain_id = s.id AND x.price_per_g IS NOT NULL) pr ON TRUE
    WHERE ${only}::int[] IS NULL OR s.id = ANY(${only}::int[])
    ORDER BY s.created_at DESC, s.id DESC`;
}

// Lekki spis odmian (bez wpisów): dopasowania w katalogu, smaki do podpowiedzi, odmiany z tej samej puli
export async function strainIndex() {
  await ensureDb();
  return sql()`SELECT id, producer, name, taste, pool_key(id, producer, thc, cbd) AS pool_key FROM strains ORDER BY created_at DESC, id DESC`;
}

export async function listOptions() {
  await ensureDb();
  const rows = await sql()`SELECT kind, value FROM options ORDER BY id`;
  return {
    producer: rows.filter((r) => r.kind === 'producer').map((r) => r.value),
    type: rows.filter((r) => r.kind === 'type').map((r) => r.value),
    terpene: rows.filter((r) => r.kind === 'terpene').map((r) => r.value),
  };
}

// Zwraca istniejącą opcję (bez względu na wielkość liter) albo dopisuje nową.
export async function canonOption(kind, raw) {
  const value = String(raw ?? '').trim().slice(0, 40);
  if (!value) return null;
  const q = sql();
  const found = await q`SELECT value FROM options WHERE kind = ${kind} AND lower(value) = lower(${value})`;
  if (found.length) return found[0].value;
  await q`INSERT INTO options (kind, value) VALUES (${kind}, ${value}) ON CONFLICT DO NOTHING`;
  return value;
}

// Walidacja pól wspólnych. Zwraca { error } albo { fields }.
export async function parseCommon(body) {
  const name = String(body.name ?? '').trim().slice(0, 60);
  if (!name) return { error: 'Podaj nazwę odmiany.' };
  const producer = await canonOption('producer', body.producer);
  if (!producer) return { error: 'Wybierz producenta.' };
  const type = await canonOption('type', body.type);
  if (!type) return { error: 'Wybierz typ.' };
  const fr = parseNumber(body.finalRating, 0, 10);
  if (Number.isNaN(fr)) return { error: 'Ocena końcowa musi być liczbą od 0 do 10.' };
  const taste = String(body.taste ?? '').trim().slice(0, 120);
  const kind = String(body.kind ?? '').trim().toLowerCase() || null;
  if (kind && !KINDS.some((k) => k.value === kind)) return { error: 'Nieznany rodzaj (indica, sativa lub hybryda).' };
  const thc = parseNumber(body.thc, 0, 100);
  const cbd = parseNumber(body.cbd, 0, 100);
  if (Number.isNaN(thc) || Number.isNaN(cbd)) return { error: 'THC i CBD muszą być liczbami od 0 do 100 (%).' };
  const terpenes = [];
  for (const t of Array.isArray(body.terpenes) ? body.terpenes.slice(0, 12) : []) {
    const c = await canonOption('terpene', t);
    if (c && !terpenes.includes(c)) terpenes.push(c);
  }
  const description = String(body.description ?? '').trim().slice(0, 2000);
  const price = parseNumber(body.price, 0, 10000);
  if (Number.isNaN(price)) return { error: 'Cena za gram musi być liczbą od 0 do 10000.' };
  const batch = String(body.batch ?? '').trim().slice(0, 40);
  const expires = String(body.expires ?? '').trim() || null;
  if (expires && (!/^\d{4}-\d{2}-\d{2}$/.test(expires) || Number.isNaN(Date.parse(expires)))) return { error: 'Nieprawidłowa data ważności.' };
  const sources = [];
  for (const x of Array.isArray(body.sources) ? body.sources.slice(0, 5) : []) {
    try {
      const u = new URL(String(x?.url));
      if (['http:', 'https:'].includes(u.protocol)) sources.push({ title: String(x.title || u.hostname).slice(0, 120), url: u.toString().slice(0, 300) });
    } catch { /* pomijamy błędny adres */ }
  }
  const descriptionAuto = !!body.descriptionAuto && description.length > 0;
  const form = FORM_VALUES.includes(String(body.form ?? '').toLowerCase()) ? String(body.form).toLowerCase() : 'susz';
  return { fields: { name, producer, type, finalRating: fr, taste, kind, thc, cbd, terpenes, description, price, batch, expires, form, sources, descriptionAuto } };
}

// null dla pustego pola, NaN dla błędnej wartości.
export function parseNumber(v, min, max) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return NaN;
  return Math.round(n * 100) / 100;
}

export async function listTests(strainId, viewerId = 0) {
  await ensureDb();
  const v = Number(viewerId) || 0;
  return sql()`SELECT t.id, t.user_id AS "userId", u.username, t.note, (t.data IS NOT NULL) AS "hasPhoto", t.visibility,
                      floor(extract(epoch FROM COALESCE(t.updated_at, t.created_at)))::int AS pv,
                      to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
               FROM strain_tests t LEFT JOIN users u ON u.id = t.user_id
               WHERE t.strain_id = ${strainId} AND can_see(${v}::int, t.user_id, t.visibility)
               ORDER BY t.created_at DESC, t.id DESC`;
}

// Wykupione w bieżącym miesiącu (g i zł)
// Podsumowanie bieżącego miesiąca (do karty "Twój miesiąc" na stronie Historia). Bez nowych tabel:
// liczy z usage_log, user_strain i purchases.
export async function monthlyRecap(userId) {
  await ensureDb();
  const q = sql();
  const [u] = await q`
    SELECT COALESCE(SUM(l.grams), 0)::float8 AS total_grams,
           COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)::int AS active_days
    FROM usage_log l
    WHERE l.user_id = ${userId} AND date_trunc('month', l.created_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')`;
  const [top] = await q`
    SELECT s.name, SUM(l.grams)::float8 AS grams
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND date_trunc('month', l.created_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')
    GROUP BY s.id, s.name ORDER BY grams DESC LIMIT 1`;
  const [r] = await q`
    SELECT AVG(rating)::float8 AS avg_rating, COUNT(*)::int AS n
    FROM user_strain WHERE user_id = ${userId} AND rating IS NOT NULL
      AND date_trunc('month', rated_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')`;
  return {
    totalGrams: u.total_grams, activeDays: u.active_days,
    topStrain: top ? { name: top.name, grams: top.grams } : null,
    avgRating: r.n > 0 ? r.avg_rating : null, ratedCount: r.n,
  };
}

export async function purchaseStats(userId) {
  await ensureDb();
  const [r] = await sql()`SELECT COALESCE(SUM(grams), 0)::float8 AS grams, COALESCE(SUM(cost), 0)::float8 AS cost
                          FROM purchases WHERE user_id = ${userId}
                            AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'`;
  return r;
}

// Historia zakupów i zużycia (ostatnie 50 wpisów)
export async function history(userId) {
  await ensureDb();
  const q = sql();
  const purchases = await q`SELECT strain_name AS name, grams::float8 AS grams, cost::float8 AS cost,
      to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
    FROM purchases WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 50`;
  const usage = await q`SELECT s.name, l.grams::float8 AS grams,
      to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
    FROM usage_log l JOIN strains s ON s.id = l.strain_id WHERE l.user_id = ${userId} ORDER BY l.created_at DESC LIMIT 50`;
  const weekly = await q`
    SELECT to_char(gs, 'DD.MM') AS label, COALESCE(SUM(l.grams), 0)::float8 AS grams
    FROM generate_series(date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '7 weeks',
                         date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw'), interval '1 week') gs
    LEFT JOIN usage_log l ON l.user_id = ${userId} AND date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw') = gs
    GROUP BY gs ORDER BY gs`;
  const top = await q`SELECT s.name, SUM(l.grams)::float8 AS grams
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND l.created_at > now() - interval '30 days'
    GROUP BY s.id, s.name ORDER BY 2 DESC LIMIT 5`;
  return { purchases, usage, weekly, top };
}

// Zużycie użytkownika z ostatnich 30 dni: średnio g/dzień oraz koszt (wg ceny za gram odmiany)
// Zwraca aktywne recepty użytkownika, którym kończy się ważność (≤7 dni) lub już wygasły,
// a mimo to zostało z nich niewykorzystane ilości (do przypomnienia na stronie głównej)
export async function prescriptionAlerts(userId) {
  await ensureDb();
  const rows = await sql()`
    SELECT p.grams::float8 AS grams,
           COALESCE((SELECT SUM(pu.grams) FROM purchases pu WHERE pu.user_id = p.user_id
             AND (pu.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN p.issued_on AND COALESCE(p.valid_until, DATE '9999-12-31')), 0)::float8 AS bought,
           to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
           (p.valid_until - (now() AT TIME ZONE 'Europe/Warsaw')::date)::int AS days_left
    FROM prescriptions p WHERE p.user_id = ${userId} AND p.valid_until IS NOT NULL`;
  return rows
    .map((r) => ({ ...r, remaining: Math.max(r.grams - r.bought, 0) }))
    .filter((r) => r.remaining > 0 && r.days_left <= 7);
}

export async function dailyUse(userId) {
  await ensureDb();
  const [r] = await sql()`
    SELECT COALESCE(SUM(l.grams), 0)::float8 AS total,
           COALESCE(SUM(l.grams * COALESCE(s.price_per_g, 0)), 0)::float8 AS cost,
           GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (now() - MIN(l.created_at))) / 86400)))::float8 AS days
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND l.created_at > now() - interval '30 days'`;
  return { perDay: r.total > 0 ? r.total / r.days : 0, cost: r.cost };
}
