import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseCorrection } from '@/lib/corrections';
import { METHODS, PERIODS, parseChoice } from '@/lib/usage-meta';

// Korekta własnego wpisu zużycia (Historia): gramy i/lub dzień. Jedno zapytanie: blokada wpisu i stanu, zmiana stanu
// o różnicę gramów (nie poniżej 0). stock_delta (ile faktycznie odjęto ze stanu) idzie za korektą, więc późniejsze
// „Cofnij” lub usunięcie oddaje właściwą ilość; dla wpisu sprzed POM-02 (NULL) przyjmujemy, że odjęto całe gramy.
// Zmiana dnia zostawia godzinę i nie zmienia stanu; wynik nie może być w przyszłości.
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const body = await req.json().catch(() => ({}));
  // sposób i pora: undefined = bez zmiany, null = wyczyszczone (pora wraca do wyliczanej z godziny zapisu)
  const method = parseChoice(body.method, METHODS), period = parseChoice(body.period, PERIODS);
  if (method === false || period === false) return bad('Błędny sposób lub pora przyjęcia.');
  const c = parseCorrection(body, { maxGrams: 1000, extra: method !== undefined || period !== undefined });
  if (c.error) return bad(c.error);
  const setM = method !== undefined, setP = period !== undefined;

  const [row] = await sql()`WITH e AS (
      SELECT l.id, l.strain_id, l.grams, coalesce(l.stock_delta, l.grams) AS sd, coalesce(${c.grams}::numeric, l.grams) AS ng,
             to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
      FROM usage_log l WHERE l.id = ${id}::int AND l.user_id = ${user.id}::int FOR UPDATE
    ), st0 AS (
      SELECT us.current_amount FROM user_strain us JOIN e ON us.strain_id = e.strain_id WHERE us.user_id = ${user.id}::int FOR UPDATE OF us
    ), c AS (
      -- more: ile więcej zdjąć ze stanu (ujemne = oddać); przy zmniejszeniu oddajemy tylko to, co faktycznie odjęto
      SELECT e.*, CASE WHEN e.ng > e.grams THEN LEAST(e.ng - e.grams, GREATEST(coalesce((SELECT current_amount FROM st0), 0), 0))
                       ELSE LEAST(e.sd, e.ng) - e.sd END AS more
      FROM e
    ), ul AS (
      UPDATE usage_log l SET grams = c.ng, stock_delta = c.sd + c.more,
        method = CASE WHEN ${setM}::boolean THEN ${method ?? null}::text ELSE l.method END,
        period = CASE WHEN ${setP}::boolean THEN ${period ?? null}::text ELSE l.period END,
        created_at = CASE WHEN ${c.day}::date IS NULL THEN l.created_at
                          ELSE LEAST((${c.day}::date + (l.created_at AT TIME ZONE 'Europe/Warsaw')::time) AT TIME ZONE 'Europe/Warsaw', now()) END
      FROM c WHERE l.id = c.id
      RETURNING l.grams, to_char(l.created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
    ), su AS (
      UPDATE user_strain us SET current_amount = us.current_amount - c.more, updated_at = now()
      FROM c WHERE us.strain_id = c.strain_id AND us.user_id = ${user.id}::int AND c.more <> 0
      RETURNING us.current_amount
    )
    SELECT c.grams::float8 AS old_grams, c.day AS old_day, ul.grams::float8 AS grams, ul.day,
           coalesce((SELECT current_amount FROM su), (SELECT current_amount FROM st0), 0)::float8 AS current
    FROM c, ul`;
  if (!row) return bad('Nie znaleziono wpisu.', 404);
  return NextResponse.json({ current: row.current, grams: row.grams, day: row.day });
});

// Usunięcie własnego wpisu zużycia: wpis znika, a do stanu wraca to, co z niego odjęto
export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const [row] = await sql()`WITH d AS (
      DELETE FROM usage_log WHERE id = ${id}::int AND user_id = ${user.id}::int
      RETURNING strain_id, grams, coalesce(stock_delta, grams) AS sd, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS day
    ), su AS (
      UPDATE user_strain us SET current_amount = us.current_amount + d.sd, updated_at = now()
      FROM d WHERE us.strain_id = d.strain_id AND us.user_id = ${user.id}::int
      RETURNING us.current_amount
    )
    SELECT d.grams::float8 AS grams, d.day, coalesce((SELECT current_amount FROM su), 0)::float8 AS current FROM d`;
  if (!row) return bad('Nie znaleziono wpisu.', 404);
  return NextResponse.json({ current: row.current });
});
