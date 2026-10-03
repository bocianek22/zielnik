import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { requestId } from '@/lib/ids';
import { parseNumber } from '@/lib/strains';

// Zapis wykupu: zwiększa stan, zmniejsza pulę "do wykupienia", dopisuje wpis do historii zakupów.
// requestId (z klienta): ponowione żądanie nie zapisuje drugi raz i oddaje pierwszy wpis.
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const body = await req.json().catch(() => ({}));
  const g = parseNumber(body.grams, 0.01, 100000);
  if (g == null || Number.isNaN(g)) return bad('Podaj ilość w gramach.');
  const rid = requestId(body.requestId);
  if (rid === undefined) return bad('Błędny identyfikator zapisu.');

  // jedno zapytanie: blokada puli, wpis do historii (pomijany przy powtórzonym requestId), a dopiero po nim
  // zmiana stanu i puli. Dodawanie w samym zapytaniu (nie z odczytanej wcześniej wartości), żeby równoległe zapisy
  // się nie nadpisywały; wpis osobisty powstaje przy pierwszym zapisie (MOB-10), a SELECT z strains pomija odmianę
  // usuniętą w międzyczasie. pool_delta: o ile faktycznie zmniejszono pulę (tyle odda „Cofnij”).
  const [row] = await sql()`WITH s AS (
      SELECT id, name, price_per_g, pool_key(id, producer, thc, cbd) AS pk FROM strains WHERE id = ${id}::int
    ), p AS (
      SELECT remaining_to_buy FROM user_pool WHERE user_id = ${user.id}::int AND pool_key = (SELECT pk FROM s) FOR UPDATE
    ), ins AS (
      INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost, request_id, pool_delta)
      SELECT ${user.id}::int, s.id, s.name, ${g}::numeric, round(s.price_per_g * ${g}::numeric, 2), ${rid}::text,
             LEAST(${g}::numeric, GREATEST(coalesce((SELECT remaining_to_buy FROM p), 0), 0))
      FROM s
      ON CONFLICT (user_id, request_id) DO NOTHING
      RETURNING id, grams, pool_delta
    ), st AS (
      INSERT INTO user_strain (strain_id, user_id, current_amount)
      SELECT ${id}::int, ${user.id}::int, ins.grams FROM ins
      ON CONFLICT (strain_id, user_id) DO UPDATE
        SET current_amount = user_strain.current_amount + EXCLUDED.current_amount, updated_at = now()
      RETURNING current_amount
    ), pl AS (
      UPDATE user_pool up SET remaining_to_buy = up.remaining_to_buy - ins.pool_delta
      FROM ins WHERE up.user_id = ${user.id}::int AND up.pool_key = (SELECT pk FROM s) AND ins.pool_delta > 0
      RETURNING up.remaining_to_buy
    )
    SELECT ins.id, st.current_amount::float8 AS current,
           coalesce((SELECT remaining_to_buy FROM pl), (SELECT remaining_to_buy FROM p), 0)::float8 AS remaining
    FROM ins, st`;
  if (row) return NextResponse.json({ id: row.id, current: row.current, remaining: row.remaining, bought: g });

  // powtórzony requestId (osobne zapytanie: wpis zapisany równolegle nie jest widoczny w migawce zapytania wyżej)
  const [dup] = rid ? await sql()`SELECT pu.id, pu.grams::float8 AS bought, coalesce(us.current_amount, 0)::float8 AS current,
                                         coalesce(p.remaining_to_buy, 0)::float8 AS remaining
                                  FROM purchases pu
                                  JOIN strains s ON s.id = pu.strain_id
                                  LEFT JOIN user_strain us ON us.strain_id = pu.strain_id AND us.user_id = pu.user_id
                                  LEFT JOIN user_pool p ON p.user_id = pu.user_id AND p.pool_key = pool_key(s.id, s.producer, s.thc, s.cbd)
                                  WHERE pu.user_id = ${user.id}::int AND pu.request_id = ${rid}::text AND pu.strain_id = ${id}::int` : [];
  if (dup) return NextResponse.json({ id: dup.id, current: dup.current, remaining: dup.remaining, bought: dup.bought });
  return bad('Nie znaleziono odmiany.', 404); // usunięta w międzyczasie (albo requestId użyty przy innej odmianie)
});

// „Cofnij” po zapisie: usuwa własny wpis z ostatnich 10 minut, zdejmuje wykupione gramy ze stanu (nie poniżej 0)
// i oddaje pulę "do wykupienia" o tyle, o ile ją zmniejszono, w jednym zapytaniu. Pula odmiany liczona teraz
// (zmiana producenta lub THC przenosi wartości na nowy klucz, DT-12) i blokowana jako pierwsza, jak przy zapisie.
export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const entryId = intId((await req.json().catch(() => ({}))).id);
  if (!entryId) return bad('Błędny identyfikator wpisu.');
  const [row] = await sql()`WITH s AS (
      SELECT pool_key(id, producer, thc, cbd) AS pk FROM strains WHERE id = ${id}::int
    ), p AS (
      SELECT remaining_to_buy FROM user_pool WHERE user_id = ${user.id}::int AND pool_key = (SELECT pk FROM s) FOR UPDATE
    ), d AS (
      DELETE FROM purchases WHERE id = ${entryId}::int AND user_id = ${user.id}::int AND strain_id = ${id}::int
        AND pool_delta IS NOT NULL AND created_at > now() - interval '10 minutes'
        AND (SELECT count(*) FROM p) >= 0 -- zawsze prawda: wymusza blokadę puli przed usunięciem wpisu (kolejność jak w POST)
      RETURNING grams, pool_delta
    ), st AS (
      UPDATE user_strain us SET current_amount = GREATEST(us.current_amount - d.grams, 0), updated_at = now()
      FROM d WHERE us.strain_id = ${id}::int AND us.user_id = ${user.id}::int
      RETURNING us.current_amount
    ), pl AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT ${user.id}::int, s.pk, d.pool_delta FROM d, s WHERE d.pool_delta > 0
      ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = user_pool.remaining_to_buy + EXCLUDED.remaining_to_buy
      RETURNING remaining_to_buy
    )
    SELECT d.grams::float8 AS grams, coalesce((SELECT current_amount FROM st), 0)::float8 AS current,
           coalesce((SELECT remaining_to_buy FROM pl), (SELECT remaining_to_buy FROM p), 0)::float8 AS remaining
    FROM d`;
  if (!row) return bad('Tego zapisu nie można już cofnąć.', 404);
  return NextResponse.json({ current: row.current, remaining: row.remaining, bought: -row.grams });
});
