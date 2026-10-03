import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseCorrection, MAX_COST } from '@/lib/corrections';

// Korekta własnego zakupu (Historia): gramy, koszt (cena za gram ALBO łączny koszt) i/lub dzień. Jedno zapytanie,
// blokady w kolejności jak przy zapisie i „Cofnij”: pula, wpis, stan. Stan zmienia się o różnicę gramów (nie poniżej 0),
// pula „do wykupienia” jak przy zakupie: zwiększenie zdejmuje z puli tyle, ile w niej jest; zmniejszenie oddaje tylko
// to, co z puli zdjęto (pool_delta; wpis sprzed POM-02 = 0, bo nie wiadomo, ile zdjął). Bez nowego kosztu przy zmianie
// gramów koszt zmienia się proporcjonalnie (cena za gram zostaje). Zakup odmiany usuniętej z bazy: tylko sam wpis.
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const c = parseCorrection(await req.json().catch(() => ({})), { maxGrams: 100000, purchase: true });
  if (c.error) return bad(c.error);

  const [row] = await sql()`WITH k AS (
      SELECT pu.strain_id, pool_key(s.id, s.producer, s.thc, s.cbd) AS pk
      FROM purchases pu JOIN strains s ON s.id = pu.strain_id WHERE pu.id = ${id}::int AND pu.user_id = ${user.id}::int
    ), p AS (
      SELECT remaining_to_buy FROM user_pool WHERE user_id = ${user.id}::int AND pool_key = (SELECT pk FROM k) FOR UPDATE
    ), e AS (
      SELECT pu.id, pu.strain_id, pu.grams, pu.cost, coalesce(pu.pool_delta, 0) AS pd, coalesce(${c.grams}::numeric, pu.grams) AS ng,
             to_char(pu.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
      FROM purchases pu WHERE pu.id = ${id}::int AND pu.user_id = ${user.id}::int
        AND (SELECT count(*) FROM p) >= 0 -- zawsze prawda: wymusza blokadę puli przed blokadą wpisu
      FOR UPDATE
    ), c0 AS (
      -- more: ile więcej zdjąć z puli (ujemne = oddać do puli)
      SELECT e.*, CASE WHEN e.ng > e.grams THEN LEAST(e.ng - e.grams, GREATEST(coalesce((SELECT remaining_to_buy FROM p), 0), 0))
                       ELSE LEAST(e.pd, e.ng) - e.pd END AS more,
             CASE ${c.costMode}::text WHEN 'price' THEN round(${c.costValue}::numeric * e.ng, 2)
                                      WHEN 'cost' THEN ${c.costValue}::numeric
                                      ELSE round(e.cost * e.ng / e.grams, 2) END AS nc
      FROM e
    ), c AS (
      SELECT c0.*, (c0.nc IS NULL OR c0.nc <= ${MAX_COST}::numeric) AS ok FROM c0
    ), ul AS (
      UPDATE purchases pu SET grams = c.ng, cost = c.nc, pool_delta = c.pd + c.more,
        created_at = CASE WHEN ${c.day}::date IS NULL THEN pu.created_at
                          ELSE LEAST((${c.day}::date + (pu.created_at AT TIME ZONE 'Europe/Warsaw')::time) AT TIME ZONE 'Europe/Warsaw', now()) END
      FROM c WHERE pu.id = c.id AND c.ok
      RETURNING pu.grams, pu.cost, to_char(pu.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
    ), su AS (
      UPDATE user_strain us SET current_amount = GREATEST(us.current_amount + (c.ng - c.grams), 0), updated_at = now()
      FROM c WHERE us.strain_id = c.strain_id AND us.user_id = ${user.id}::int AND c.ng <> c.grams AND c.ok
      RETURNING us.current_amount
    ), pl AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT ${user.id}::int, k.pk, -c.more FROM c, k WHERE c.more <> 0 AND c.ok
      ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = user_pool.remaining_to_buy + EXCLUDED.remaining_to_buy
      RETURNING remaining_to_buy
    )
    SELECT c.ok, c.strain_id, c.grams::float8 AS old_grams, c.cost::float8 AS old_cost, c.day AS old_day,
           ul.grams::float8 AS grams, ul.cost::float8 AS cost, ul.day,
           (SELECT current_amount FROM su)::float8 AS current_new,
           (SELECT current_amount FROM user_strain WHERE strain_id = c.strain_id AND user_id = ${user.id}::int)::float8 AS current_old,
           coalesce((SELECT remaining_to_buy FROM pl), (SELECT remaining_to_buy FROM p), 0)::float8 AS remaining
    FROM c LEFT JOIN ul ON TRUE`;
  if (!row) return bad('Nie znaleziono wpisu.', 404);
  if (!row.ok) return bad('Koszt zakupu przekracza 10 000 000 zł. Sprawdź ilość i cenę.');
  // po wpisaniu ceny za gram: ile innych zakupów tej odmiany nie ma kosztu (Historia proponuje uzupełnienie)
  const missingCost = c.costMode === 'price' && row.strain_id
    ? (await sql()`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${user.id}::int AND strain_id = ${row.strain_id}::int AND cost IS NULL`)[0].n
    : 0;
  return NextResponse.json({
    current: row.current_new ?? row.current_old ?? 0, remaining: row.remaining, grams: row.grams, cost: row.cost, day: row.day,
    strainId: row.strain_id, missingCost,
  });
});

// Usunięcie własnego zakupu: stan maleje o wykupione gramy (nie poniżej 0), do puli wraca to, co z niej zdjęto
export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const [row] = await sql()`WITH k AS (
      SELECT pool_key(s.id, s.producer, s.thc, s.cbd) AS pk
      FROM purchases pu JOIN strains s ON s.id = pu.strain_id WHERE pu.id = ${id}::int AND pu.user_id = ${user.id}::int
    ), p AS (
      SELECT remaining_to_buy FROM user_pool WHERE user_id = ${user.id}::int AND pool_key = (SELECT pk FROM k) FOR UPDATE
    ), d AS (
      DELETE FROM purchases WHERE id = ${id}::int AND user_id = ${user.id}::int
        AND (SELECT count(*) FROM p) >= 0 -- zawsze prawda: wymusza blokadę puli przed usunięciem wpisu
      RETURNING strain_id, grams, cost, coalesce(pool_delta, 0) AS pd, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
    ), su AS (
      UPDATE user_strain us SET current_amount = GREATEST(us.current_amount - d.grams, 0), updated_at = now()
      FROM d WHERE us.strain_id = d.strain_id AND us.user_id = ${user.id}::int
      RETURNING us.current_amount
    ), pl AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT ${user.id}::int, k.pk, d.pd FROM d, k WHERE d.pd > 0
      ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = user_pool.remaining_to_buy + EXCLUDED.remaining_to_buy
      RETURNING remaining_to_buy
    )
    SELECT d.grams::float8 AS grams, d.cost::float8 AS cost, d.day, coalesce((SELECT current_amount FROM su), 0)::float8 AS current,
           coalesce((SELECT remaining_to_buy FROM pl), (SELECT remaining_to_buy FROM p), 0)::float8 AS remaining
    FROM d`;
  if (!row) return bad('Nie znaleziono wpisu.', 404);
  return NextResponse.json({ current: row.current, remaining: row.remaining });
});
