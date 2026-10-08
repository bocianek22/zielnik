import { ensureDb, sql } from './db';
import { intId } from './ids';
import { KINDS } from './kinds';
import { FORM_VALUES } from './forms';
import { strainTags } from './effects';
import { sharedCache, invalidateStrains } from './cache';

export { invalidateStrains };

// Stronicowanie kursorem (created_at, id) malejąco, zgodnie z kolejnością list. Kursor to „<ISO z mikrosekundami>_<id>”.
export const PAGE_MAX = 500;
const CURSOR_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z)_(\d{1,10})$/;
// Z parametrów adresu: { limit, after } albo { error }. Brak limitu = PAGE_MAX (bezpieczny górny próg).
export function parsePaging(params) {
  const rawLimit = params.get('limit');
  let limit = PAGE_MAX;
  // bez limitu i kursora: cała lista jak przed stronicowaniem (starsze klienty PWA/APK nie czytają `next`)
  const paged = (rawLimit != null && rawLimit !== '') || !!params.get('cursor');
  if (rawLimit != null && rawLimit !== '') {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1) return { error: 'Limit musi być liczbą całkowitą od 1.' };
    limit = Math.min(limit, PAGE_MAX);
  }
  const c = params.get('cursor');
  if (c == null || c === '') return { limit, after: null, paged };
  const m = CURSOR_RE.exec(c);
  // ścisła data (2026-02-30 Date przesuwa, baza odrzuca) i id w zakresie INT: zły kursor to 400, a nie błąd bazy
  const id = Number(m?.[2]);
  if (!m || Number.isNaN(Date.parse(m[1])) || new Date(m[1]).toISOString().slice(0, 19) !== m[1].slice(0, 19)
      || !(id > 0 && id <= 2147483647)) return { error: 'Nieprawidłowy kursor.' };
  return { limit, after: { ts: m[1], id }, paged };
}

// Odmiany razem z wpisami użytkowników. Cudze wpisy są filtrowane wg widoczności (can_see);
// stany i "do wykupienia" widzi wyłącznie ich właściciel.
// Wiersze user_strain powstają dopiero przy pierwszym zapisie (MOB-10), więc własny wpis oglądającego jest
// zawsze dołączany (z wartościami domyślnymi, gdy wiersza jeszcze nie ma), a cudze tylko te z treścią.
// ids: opcjonalnie tylko wybrane odmiany (np. strona odmiany, porównanie).
// limit/after: jedna strona (patrz listStrainsPage); bez nich zwraca wszystko.
export async function listStrains(viewerId = 0, { ids = null, limit = null, after = null } = {}) {
  await ensureDb();
  const v = Number(viewerId) || 0;
  const only = Array.isArray(ids) ? ids.map(intId).filter(Boolean) : null;
  const lim = limit ? Number(limit) : null;
  const rows = await sql()`
    SELECT s.id, s.producer, s.name, s.type, s.final_rating::float8 AS final_rating, s.taste, s.created_by,
      pool_key(s.id, s.producer, s.thc, s.cbd, s.form) AS pool_key, s.price_per_g::float8 AS price_per_g, s.batch,
      to_char(s.expires_on, 'YYYY-MM-DD') AS expires_on, s.thc::float8 AS thc, s.cbd::float8 AS cbd,
      s.kind, s.terpenes, s.description, s.form, s.sources, s.description_auto, strain_cursor(s.created_at, s.id) AS cur,
      (SELECT floor(extract(epoch FROM p.updated_at))::int FROM strain_photos p WHERE p.strain_id = s.id) AS photo_v,
      (SELECT json_build_object('credit', p.credit, 'license', p.license, 'licenseUrl', p.license_url, 'sourceUrl', p.source_url)
         FROM strain_photos p WHERE p.strain_id = s.id AND p.credit IS NOT NULL) AS photo_attr,
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
        LEFT JOIN user_pool up ON up.user_id = me.id AND up.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd, s.form)
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
    WHERE (${only}::int[] IS NULL OR s.id = ANY(${only}::int[]))
      AND (${after?.ts ?? null}::timestamptz IS NULL OR (s.created_at, s.id) < (${after?.ts ?? null}::timestamptz, ${after?.id ?? null}::int))
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT ${lim}::int`;
  return rows.map(({ cur, ...s }) => (lim ? { ...s, cur } : s));
}

// Strona listy: { strains, next }; next to kursor kolejnej strony albo null. Pobiera limit + 1 wierszy.
export async function listStrainsPage(viewerId, { limit = PAGE_MAX, after = null } = {}) {
  const lim = Math.min(Math.max(Number(limit) || PAGE_MAX, 1), PAGE_MAX);
  const rows = await listStrains(viewerId, { limit: lim + 1, after });
  const more = rows.length > lim;
  const page = (more ? rows.slice(0, lim) : rows).map(({ cur: _c, ...s }) => s);
  return { strains: page, next: more ? rows[lim - 1].cur : null };
}

// Lekki spis odmian (bez wpisów innych osób): dopasowania w katalogu, smaki do podpowiedzi, odmiany z tej samej puli,
// wybory odmiany w formularzach. Część wspólna (nazwa, producent, postać, smak) idzie przez pamięć podręczną; „mam” (mine)
// to osobne zapytanie o wiersze oglądającego i nigdy nie trafia do cache. limit/after: jedna strona z bazy (bez cache),
// wtedy wynik ma też pole `cur` (kursor).
const sharedIndex = sharedCache(async () => {
  await ensureDb();
  return sql()`SELECT id, producer, name, type, form, form_unit(form) AS unit, taste, pool_key(id, producer, thc, cbd, form) AS pool_key
               FROM strains ORDER BY created_at DESC, id DESC`;
}, ['strain-index']);

export async function strainIndex({ viewerId = 0, ids = null, limit = null, after = null } = {}) {
  await ensureDb();
  const v = Number(viewerId) || 0;
  const only = Array.isArray(ids) ? ids.map(intId).filter(Boolean) : null;
  let rows;
  if (limit || after) {
    rows = await sql()`SELECT s.id, s.producer, s.name, s.type, s.form, form_unit(s.form) AS unit, s.taste, pool_key(s.id, s.producer, s.thc, s.cbd, s.form) AS pool_key, strain_cursor(s.created_at, s.id) AS cur
      FROM strains s
      WHERE (${only}::int[] IS NULL OR s.id = ANY(${only}::int[]))
        AND (${after?.ts ?? null}::timestamptz IS NULL OR (s.created_at, s.id) < (${after?.ts ?? null}::timestamptz, ${after?.id ?? null}::int))
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ${limit ? Number(limit) : null}::int`;
  } else {
    rows = await sharedIndex();
    if (only) { const set = new Set(only); rows = rows.filter((r) => set.has(r.id)); }
  }
  if (!v) return rows;
  const mine = new Map((await sql()`SELECT strain_id, current_amount::float8 AS cur FROM user_strain WHERE user_id = ${v}::int AND current_amount > 0`).map((m) => [m.strain_id, m.cur]));
  return rows.map((r) => ({ ...r, mine: mine.get(r.id) ?? 0 }));
}

// Strona indeksu: { strains, next }
export async function strainIndexPage(viewerId, { limit = PAGE_MAX, after = null } = {}) {
  const lim = Math.min(Math.max(Number(limit) || PAGE_MAX, 1), PAGE_MAX);
  const rows = await strainIndex({ viewerId, limit: lim + 1, after });
  const more = rows.length > lim;
  return { strains: (more ? rows.slice(0, lim) : rows).map(({ cur: _c, ...r }) => r), next: more ? rows[lim - 1].cur : null };
}

// Odmiany z moim stanem > 0 (koło fortuny): tylko wiersz oglądającego, bez cudzych wpisów
export async function wheelItems(viewerId) {
  await ensureDb();
  return sql()`SELECT s.id, s.name, s.producer, s.type, s.kind, s.thc::float8 AS thc, s.form, o.current_amount::float8 AS current
    FROM user_strain o JOIN strains s ON s.id = o.strain_id
    WHERE o.user_id = ${Number(viewerId) || 0}::int AND o.current_amount > 0
    ORDER BY s.created_at DESC, s.id DESC`;
}

// Dane rankingów: odmiana + oceny widoczne dla oglądającego (jak w listStrains: własny wpis zawsze, cudze przez can_see)
// i znaczniki efektów. Bez notatek, zdjęć, opisów i cen. Strona: { strains, next }.
export async function rankingRows(viewerId, { limit = PAGE_MAX, after = null } = {}) {
  await ensureDb();
  const v = Number(viewerId) || 0;
  const lim = Math.min(Math.max(Number(limit) || PAGE_MAX, 1), PAGE_MAX);
  const rows = await sql()`
    SELECT s.id, s.name, s.producer, s.type, s.kind, s.form, s.thc::float8 AS thc, strain_cursor(s.created_at, s.id) AS cur,
      (SELECT COALESCE(json_agg(json_build_object('userId', x.user_id, 'rating', x.rating, 'at', x.rated_at, 'effects', x.effects)), '[]'::json)
       FROM user_strain x
       WHERE x.strain_id = s.id AND (x.rating IS NOT NULL OR x.effects <> '{}'::jsonb)
         AND (x.user_id = ${v}::int OR can_see(${v}::int, x.user_id, x.visibility))) AS entries
    FROM strains s
    WHERE (${after?.ts ?? null}::timestamptz IS NULL OR (s.created_at, s.id) < (${after?.ts ?? null}::timestamptz, ${after?.id ?? null}::int))
    ORDER BY s.created_at DESC, s.id DESC
    LIMIT ${lim + 1}::int`;
  const more = rows.length > lim;
  const page = more ? rows.slice(0, lim) : rows;
  return {
    strains: page.map((s) => ({
      id: s.id, name: s.name, producer: s.producer, type: s.type, kind: s.kind, form: s.form || 'susz', thc: s.thc,
      tags: strainTags({ entries: s.entries }),
      ratings: s.entries.filter((e) => e.rating != null).map((e) => ({ userId: e.userId, rating: e.rating, at: e.at })),
    })),
    next: more ? rows[lim - 1].cur : null,
  };
}

const sharedOptions = sharedCache(async () => {
  await ensureDb();
  return sql()`SELECT kind, value FROM options ORDER BY id`;
}, ['strain-options']);

export async function listOptions() {
  const rows = await sharedOptions();
  return {
    producer: rows.filter((r) => r.kind === 'producer').map((r) => r.value),
    type: rows.filter((r) => r.kind === 'type').map((r) => r.value),
    terpene: rows.filter((r) => r.kind === 'terpene').map((r) => r.value),
  };
}
// Zwraca istniejącą opcję (bez względu na wielkość liter) albo dopisuje nową.
// insert=false: nowa wartość nie trafia do wspólnej listy (propozycja zmiany: lista rośnie dopiero po akceptacji)
export async function canonOption(kind, raw, { insert = true } = {}) {
  const value = String(raw ?? '').trim().slice(0, 40);
  if (!value) return null;
  const q = sql();
  const found = await q`SELECT value FROM options WHERE kind = ${kind} AND lower(value) = lower(${value})`;
  if (found.length) return found[0].value;
  if (!insert) return value;
  await q`INSERT INTO options (kind, value) VALUES (${kind}, ${value}) ON CONFLICT DO NOTHING`;
  invalidateStrains();
  return value;
}

// Walidacja pól wspólnych. Zwraca { error } albo { fields }.
export async function parseCommon(body, { newOptions = true } = {}) {
  const ins = { insert: newOptions };
  const name = String(body.name ?? '').trim().slice(0, 60);
  if (!name) return { error: 'Podaj nazwę odmiany.' };
  const producer = await canonOption('producer', body.producer, ins);
  if (!producer) return { error: 'Wybierz producenta.' };
  const type = await canonOption('type', body.type, ins);
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
    const c = await canonOption('terpene', t, ins);
    if (c && !terpenes.includes(c)) terpenes.push(c);
  }
  const description = String(body.description ?? '').trim().slice(0, 2000);
  const price = parseNumber(body.price, 0, 10000);
  if (Number.isNaN(price)) return { error: 'Cena za gram lub ml musi być liczbą od 0 do 10000.' };
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

// Podsumowanie bieżącego miesiąca (do karty "Twój miesiąc" na stronie Historia). Bez nowych tabel:
// liczy z usage_log, user_strain i purchases.
export async function monthlyRecap(userId) {
  await ensureDb();
  const q = sql();
  const [u] = await q`
    SELECT COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 AS total_grams,
           COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 AS total_ml,
           COUNT(DISTINCT (l.created_at AT TIME ZONE 'Europe/Warsaw')::date)::int AS active_days
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND date_trunc('month', l.created_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')`;
  const [top] = await q`
    SELECT s.name, form_unit(s.form) AS unit, SUM(l.grams)::float8 AS grams
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND date_trunc('month', l.created_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')
    GROUP BY s.id, s.name ORDER BY grams DESC LIMIT 1`;
  const [r] = await q`
    SELECT AVG(rating)::float8 AS avg_rating, COUNT(*)::int AS n
    FROM user_strain WHERE user_id = ${userId} AND rating IS NOT NULL
      AND date_trunc('month', rated_at AT TIME ZONE 'Europe/Warsaw') = date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')`;
  return {
    totalGrams: u.total_grams, totalMl: u.total_ml, activeDays: u.active_days,
    topStrain: top ? { name: top.name, grams: top.grams, unit: top.unit } : null,
    avgRating: r.n > 0 ? r.avg_rating : null, ratedCount: r.n,
  };
}

export async function purchaseStats(userId) {
  await ensureDb();
  // gramy (susz) i ml (olej, pen) osobno; koszt łącznie
  const [r] = await sql()`SELECT COALESCE(SUM(grams) FILTER (WHERE strain_unit(strain_id) = 'g'), 0)::float8 AS grams,
                                 COALESCE(SUM(grams) FILTER (WHERE strain_unit(strain_id) = 'ml'), 0)::float8 AS ml,
                                 COALESCE(SUM(cost), 0)::float8 AS cost
                          FROM purchases WHERE user_id = ${userId}
                            AND created_at >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw') AT TIME ZONE 'Europe/Warsaw'`;
  return r;
}

// Historia zakupów i zużycia (ostatnie 50 wpisów)
export async function history(userId) {
  await ensureDb();
  const q = sql();
  // id, strainId i day: korekty wpisów w Historii
  const purchases = await q`SELECT id, strain_id AS "strainId", strain_name AS name, grams::float8 AS grams, cost::float8 AS cost,
      strain_unit(strain_id) AS unit,
      to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
      to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
    FROM purchases WHERE user_id = ${userId} ORDER BY created_at DESC, id DESC LIMIT 50`;
  const usage = await q`SELECT l.id, l.strain_id AS "strainId", s.name, l.grams::float8 AS grams, form_unit(s.form) AS unit, l.method, l.period, usage_period(NULL, l.created_at) AS "autoPeriod",
      to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at,
      to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
    FROM usage_log l JOIN strains s ON s.id = l.strain_id WHERE l.user_id = ${userId} ORDER BY l.created_at DESC, l.id DESC LIMIT 50`;
  const weekly = await q`
    SELECT to_char(gs, 'DD.MM') AS label,
           COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'g'), 0)::float8 AS grams,
           COALESCE(SUM(l.grams) FILTER (WHERE form_unit(s.form) = 'ml'), 0)::float8 AS ml
    FROM generate_series(date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw') - interval '7 weeks',
                         date_trunc('week', now() AT TIME ZONE 'Europe/Warsaw'), interval '1 week') gs
    LEFT JOIN usage_log l ON l.user_id = ${userId} AND date_trunc('week', l.created_at AT TIME ZONE 'Europe/Warsaw') = gs
    LEFT JOIN strains s ON s.id = l.strain_id
    GROUP BY gs ORDER BY gs`;
  const top = await q`SELECT s.name, form_unit(s.form) AS unit, SUM(l.grams)::float8 AS grams
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND l.created_at > now() - interval '30 days'
    GROUP BY s.id, s.name ORDER BY 3 DESC LIMIT 5`;
  return { purchases, usage, weekly, top };
}

// Zużycie użytkownika z ostatnich 30 dni: średnio g/dzień oraz koszt (wg ceny za gram odmiany)
// Zwraca aktywne recepty użytkownika, którym kończy się ważność (≤7 dni) lub już wygasły,
// a mimo to zostało z nich niewykorzystane ilości (do przypomnienia na stronie głównej)
export async function prescriptionAlerts(userId) {
  await ensureDb();
  const rows = await sql()`
    SELECT p.grams::float8 AS grams, p.unit,
           COALESCE((SELECT SUM(pu.grams) FROM purchases pu WHERE pu.user_id = p.user_id AND strain_unit(pu.strain_id) = p.unit
             AND (pu.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN p.issued_on AND COALESCE(p.valid_until, DATE '9999-12-31')), 0)::float8 AS bought,
           to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
           (p.valid_until - (now() AT TIME ZONE 'Europe/Warsaw')::date)::int AS days_left
    FROM prescriptions p WHERE p.user_id = ${userId} AND p.valid_until IS NOT NULL`;
  return rows
    .map((r) => ({ ...r, remaining: Math.max(r.grams - r.bought, 0) }))
    .filter((r) => r.remaining > 0 && r.days_left <= 7);
}

// Średnie dzienne zużycie z 30 dni osobno dla gramów (perDay) i ml (perDayMl); dni liczone od pierwszego wpisu
// danej jednostki w tym okresie. Koszt łącznie (cena za g lub ml odmiany).
export async function dailyUse(userId) {
  await ensureDb();
  const rows = await sql()`
    SELECT form_unit(s.form) AS unit, COALESCE(SUM(l.grams), 0)::float8 AS total,
           COALESCE(SUM(l.grams * COALESCE(s.price_per_g, 0)), 0)::float8 AS cost,
           GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (now() - MIN(l.created_at))) / 86400)))::float8 AS days
    FROM usage_log l JOIN strains s ON s.id = l.strain_id
    WHERE l.user_id = ${userId} AND l.created_at > now() - interval '30 days'
    GROUP BY 1`;
  const per = (u) => { const r = rows.find((x) => x.unit === u); return r && r.total > 0 ? r.total / r.days : 0; };
  return { perDay: per('g'), perDayMl: per('ml'), cost: rows.reduce((a, r) => a + r.cost, 0) };
}

// Pola wspólne odmiany objęte historią: kolumna w bazie -> pole z parseCommon()
export const EDIT_FIELDS = {
  producer: 'producer', name: 'name', type: 'type', final_rating: 'finalRating', taste: 'taste', thc: 'thc', cbd: 'cbd',
  kind: 'kind', terpenes: 'terpenes', description: 'description', price_per_g: 'price', batch: 'batch',
  expires_on: 'expires', form: 'form', sources: 'sources', description_auto: 'descriptionAuto',
};

// Zapis pól wspólnych odmiany + wpis historii (różnica starych i nowych wartości) w jednej transakcji.
// Pole nieobecne w `f` (undefined) zostaje bez zmian, dzięki temu przywracanie z historii dotyka tylko
// pól z wpisu i nie cofa równoległych edycji innych pól (bez odczytu w JS przed zapisem).
// Zwraca { id } albo null, gdy odmiany nie ma.
export async function updateStrain(id, f, userId) {
  await ensureDb();
  const has = (k) => f[k] !== undefined;
  const v = (k) => (has(k) ? f[k] : null);
  const q = sql();
  // Zmiana producenta/THC/CBD zmienia klucz puli "do wykupienia" (pool_key), więc w tym samym zapytaniu
  // przenosimy wartości wszystkich osób na nowy klucz. Gdy inna odmiana nadal ma stary klucz, stara pula
  // zostaje, a nowa dostaje tylko kopię (jeśli jej jeszcze nie ma). Przy kolizji z istniejącą nową pulą
  // bierzemy większą wartość (GREATEST), jak migracja w init(): to ta sama recepta, więc sumowanie
  // liczyłoby ją podwójnie.
  // Dwa polecenia w jednej transakcji: najpierw blokada wiersza odmiany, potem właściwa zmiana. Drugie
  // polecenie dostaje migawkę już po uzyskaniu blokady, więc równoległa edycja tej samej odmiany widzi pule
  // przeniesione przez pierwszą (w jednym poleceniu migawka byłaby sprzed czekania na blokadę).
  const [, rows] = await q.transaction([q`SELECT 1 FROM strains WHERE id = ${id} FOR UPDATE`, q`WITH old AS (
      SELECT id, pool_key(id, producer, thc, cbd, form) AS k,
             jsonb_build_object('producer', producer, 'name', name, 'type', type, 'final_rating', final_rating, 'taste', taste,
               'thc', thc, 'cbd', cbd, 'kind', kind, 'terpenes', terpenes, 'description', description, 'price_per_g', price_per_g,
               'batch', batch, 'expires_on', expires_on, 'form', form, 'sources', sources, 'description_auto', description_auto) AS j
      FROM strains WHERE id = ${id} FOR UPDATE
    ), upd AS (
      UPDATE strains s SET
             producer = CASE WHEN ${has('producer')}::boolean THEN ${v('producer')}::text ELSE s.producer END,
             name = CASE WHEN ${has('name')}::boolean THEN ${v('name')}::text ELSE s.name END,
             type = CASE WHEN ${has('type')}::boolean THEN ${v('type')}::text ELSE s.type END,
             final_rating = CASE WHEN ${has('finalRating')}::boolean THEN ${v('finalRating')}::numeric ELSE s.final_rating END,
             taste = CASE WHEN ${has('taste')}::boolean THEN ${v('taste')}::text ELSE s.taste END,
             thc = CASE WHEN ${has('thc')}::boolean THEN ${v('thc')}::numeric ELSE s.thc END,
             cbd = CASE WHEN ${has('cbd')}::boolean THEN ${v('cbd')}::numeric ELSE s.cbd END,
             kind = CASE WHEN ${has('kind')}::boolean THEN ${v('kind')}::text ELSE s.kind END,
             terpenes = CASE WHEN ${has('terpenes')}::boolean THEN ${JSON.stringify(v('terpenes') ?? [])}::jsonb ELSE s.terpenes END,
             description = CASE WHEN ${has('description')}::boolean THEN ${v('description')}::text ELSE s.description END,
             price_per_g = CASE WHEN ${has('price')}::boolean THEN ${v('price')}::numeric ELSE s.price_per_g END,
             batch = CASE WHEN ${has('batch')}::boolean THEN ${v('batch')}::text ELSE s.batch END,
             expires_on = CASE WHEN ${has('expires')}::boolean THEN ${v('expires')}::date ELSE s.expires_on END,
             form = CASE WHEN ${has('form')}::boolean THEN ${v('form')}::text ELSE s.form END,
             sources = CASE WHEN ${has('sources')}::boolean THEN ${JSON.stringify(v('sources') ?? [])}::jsonb ELSE s.sources END,
             description_auto = CASE WHEN ${has('descriptionAuto')}::boolean THEN ${v('descriptionAuto')}::boolean ELSE s.description_auto END
      FROM old WHERE s.id = old.id
      RETURNING s.id, old.k AS old_key, old.j AS old_j, pool_key(s.id, s.producer, s.thc, s.cbd, s.form) AS new_key,
             jsonb_build_object('producer', s.producer, 'name', s.name, 'type', s.type, 'final_rating', s.final_rating, 'taste', s.taste,
               'thc', s.thc, 'cbd', s.cbd, 'kind', s.kind, 'terpenes', s.terpenes, 'description', s.description, 'price_per_g', s.price_per_g,
               'batch', s.batch, 'expires_on', s.expires_on, 'form', s.form, 'sources', s.sources, 'description_auto', s.description_auto) AS new_j
    ), diff AS (
      SELECT u.id, (SELECT jsonb_object_agg(k, jsonb_build_array(u.old_j -> k, u.new_j -> k))
                    FROM jsonb_object_keys(u.new_j) k WHERE u.old_j -> k IS DISTINCT FROM u.new_j -> k) AS changes
      FROM upd u
    ), hist AS (
      INSERT INTO strain_edits (strain_id, user_id, changes)
      SELECT id, ${userId}::int, changes FROM diff WHERE changes IS NOT NULL
    ), mv AS (
      SELECT u.old_key, u.new_key,
             EXISTS (SELECT 1 FROM strains o WHERE o.id <> u.id AND pool_key(o.id, o.producer, o.thc, o.cbd, o.form) = u.old_key) AS shared
      FROM upd u WHERE u.old_key <> u.new_key
    ), moved AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT up.user_id, mv.new_key, up.remaining_to_buy FROM user_pool up JOIN mv ON up.pool_key = mv.old_key WHERE NOT mv.shared
      ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = GREATEST(user_pool.remaining_to_buy, EXCLUDED.remaining_to_buy)
    ), copied AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT up.user_id, mv.new_key, up.remaining_to_buy FROM user_pool up JOIN mv ON up.pool_key = mv.old_key WHERE mv.shared
      ON CONFLICT (user_id, pool_key) DO NOTHING
    ), dropped AS (
      DELETE FROM user_pool up USING mv WHERE up.pool_key = mv.old_key AND NOT mv.shared
    )
    SELECT id FROM upd`], { isolationMode: 'ReadCommitted' });
  invalidateStrains();
  return rows[0] || null;
}

// Historia zmian odmiany (50 ostatnich). Nazwę edytującego widać dla wszystkich zalogowanych (jak twórcę
// odmiany), chyba że oglądający i edytujący się blokują: wtedy "ktoś".
export async function listHistory(strainId, viewerId) {
  await ensureDb();
  return sql()`SELECT e.id, e.user_id = ${viewerId}::int AS mine,
      -- kto edytował, to informacja o kontakcie z odmianą (dane zdrowotne): nazwa tylko zgodnie z widocznością profilu
      -- (can_see obejmuje też blokady), inaczej "ktoś"
      CASE WHEN e.actor IS NOT NULL THEN e.actor
           WHEN e.user_id IS NULL OR NOT can_see(${viewerId}::int, e.user_id, u.profile_visibility) THEN 'ktoś'
           ELSE COALESCE(NULLIF(u.display_name, ''), u.username) END AS who,
      to_char(e.at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at, e.changes
    FROM strain_edits e LEFT JOIN users u ON u.id = e.user_id
    WHERE e.strain_id = ${strainId} ORDER BY e.at DESC, e.id DESC LIMIT 50`;
}
