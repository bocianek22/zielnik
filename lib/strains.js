import { ensureDb, sql } from './db';
import { KINDS } from './kinds';

// Odmiany razem z wpisami użytkowników. Cudze wpisy są filtrowane wg widoczności (can_see);
// stany i "do wykupienia" widzi wyłącznie ich właściciel.
export async function listStrains(viewerId = 0) {
  await ensureDb();
  const v = Number(viewerId) || 0;
  return sql()`
    SELECT s.id, s.producer, s.name, s.type, s.final_rating::float8 AS final_rating, s.taste, s.created_by,
      pool_key(s.id, s.producer, s.thc, s.cbd) AS pool_key, s.price_per_g::float8 AS price_per_g, s.batch,
      to_char(s.expires_on, 'YYYY-MM-DD') AS expires_on, s.thc::float8 AS thc, s.cbd::float8 AS cbd,
      s.kind, s.terpenes, s.description,
      (SELECT floor(extract(epoch FROM p.updated_at))::int FROM strain_photos p WHERE p.strain_id = s.id) AS photo_v,
      COALESCE(json_agg(json_build_object(
        'userId', us.user_id, 'username', u.username, 'displayName', u.display_name,
        'rating', CASE WHEN vis.ok THEN us.rating END,
        'ratedAt', CASE WHEN vis.ok THEN us.rated_at END,
        'current', CASE WHEN us.user_id = ${v}::int THEN us.current_amount END,
        'remaining', CASE WHEN us.user_id = ${v}::int THEN COALESCE(up.remaining_to_buy, 0) END,
        'notes', CASE WHEN vis.ok THEN us.notes ELSE '' END,
        'effects', CASE WHEN vis.ok THEN us.effects ELSE '{}'::jsonb END,
        'visibility', CASE WHEN us.user_id = ${v}::int THEN us.visibility END
      ) ORDER BY lower(u.username)) FILTER (WHERE us.user_id = ${v}::int
        OR (vis.ok AND (us.rating IS NOT NULL OR us.notes <> '' OR us.effects <> '{}'::jsonb))), '[]'::json) AS entries
    FROM strains s
    LEFT JOIN user_strain us ON us.strain_id = s.id
    LEFT JOIN users u ON u.id = us.user_id
    LEFT JOIN user_pool up ON up.user_id = us.user_id AND up.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd)
    LEFT JOIN LATERAL (SELECT can_see(${v}::int, us.user_id, us.visibility) AS ok) vis ON TRUE
    GROUP BY s.id
    ORDER BY s.created_at DESC, s.id DESC`;
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
  return { fields: { name, producer, type, finalRating: fr, taste, kind, thc, cbd, terpenes, description, price, batch, expires } };
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
                      to_char(t.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "createdAt"
               FROM strain_tests t LEFT JOIN users u ON u.id = t.user_id
               WHERE t.strain_id = ${strainId} AND can_see(${v}::int, t.user_id, t.visibility)
               ORDER BY t.created_at DESC, t.id DESC`;
}

// Wykupione w bieżącym miesiącu (g i zł)
export async function purchaseStats(userId) {
  await ensureDb();
  const [r] = await sql()`SELECT COALESCE(SUM(grams), 0)::float8 AS grams, COALESCE(SUM(cost), 0)::float8 AS cost
                          FROM purchases WHERE user_id = ${userId} AND created_at >= date_trunc('month', now())`;
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
