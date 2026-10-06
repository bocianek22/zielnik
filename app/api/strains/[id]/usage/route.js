import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { requestId, clientAt, otherAccount, OTHER_ACCOUNT_MSG } from '@/lib/ids';
import { parseNumber } from '@/lib/strains';
import { METHODS, PERIODS, parseChoice } from '@/lib/usage-meta';

// Zapis zużycia: odejmuje gramy od Twojego aktualnego stanu i dopisuje wpis do dziennika.
// requestId (z klienta): ponowione żądanie (np. po zerwanym połączeniu) nie zapisuje drugi raz i oddaje pierwszy wpis.
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const body = await req.json().catch(() => ({}));
  const g = parseNumber(body.grams, 0.01, 1000);
  if (g == null || Number.isNaN(g)) return bad('Podaj ilość (g lub ml, 0,01–1000).');
  const rid = requestId(body.requestId);
  if (rid === undefined) return bad('Błędny identyfikator zapisu.');
  const method = parseChoice(body.method, METHODS) ?? null, period = parseChoice(body.period, PERIODS) ?? null;
  if (method === false || period === false) return bad('Błędny sposób lub pora przyjęcia.');
  if (otherAccount(body, user)) return bad(OTHER_ACCOUNT_MSG, 409);
  // zapis z kolejki offline niesie czas zapisu na telefonie (najwyżej 72 h wstecz), inaczej liczy się czas serwera
  const at = clientAt(body.at)?.toISOString() ?? null;

  const q = sql();
  const exists = await q`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  await q`INSERT INTO user_strain (strain_id, user_id) VALUES (${id}, ${user.id}) ON CONFLICT DO NOTHING`;
  // jedno zapytanie: blokada wiersza stanu, wpis do dziennika (pomijany przy powtórzonym requestId) i odjęcie
  // dokładnie tego, co zapisano we wpisie (stock_delta), więc dwa szybkie zapisy się nie nadpiszą, a ponowienie
  // nie odejmie drugi raz. Zużycie zawsze trafia do dziennika, nawet gdy zapisany stan był mniejszy.
  const [row] = await q`WITH old AS (
      SELECT current_amount FROM user_strain WHERE strain_id = ${id}::int AND user_id = ${user.id}::int FOR UPDATE
    ), ins AS (
      INSERT INTO usage_log (user_id, strain_id, grams, request_id, stock_delta, method, period, created_at)
      SELECT ${user.id}::int, ${id}::int, ${g}::numeric, ${rid}::text, LEAST(${g}::numeric, GREATEST(old.current_amount, 0)),
             ${method}::text, ${period}::text,
             COALESCE(${at}::timestamptz, now()) FROM old
      ON CONFLICT (user_id, request_id) DO NOTHING
      RETURNING id, grams, stock_delta
    ), upd AS (
      UPDATE user_strain us SET current_amount = us.current_amount - ins.stock_delta, updated_at = now()
      FROM ins WHERE us.strain_id = ${id}::int AND us.user_id = ${user.id}::int
      RETURNING us.current_amount
    ), nu AS (
      -- zapisane zużycie zdejmuje znacznik „dzień bez zużycia” z tego dnia (POM-38), w tym samym poleceniu
      DELETE FROM no_use_days WHERE user_id = ${user.id}::int AND EXISTS (SELECT 1 FROM ins)
        AND day = (COALESCE(${at}::timestamptz, now()) AT TIME ZONE 'Europe/Warsaw')::date
    )
    SELECT ins.id, ins.grams::float8 AS used, upd.current_amount::float8 AS current, ins.stock_delta < ins.grams AS short
    FROM ins, upd`;
  if (row) return NextResponse.json({ id: row.id, current: row.current, used: row.used, stockShort: row.short });

  // powtórzony requestId (osobne zapytanie: wpis zapisany równolegle nie jest widoczny w migawce zapytania wyżej)
  const [dup] = rid ? await q`SELECT l.id, l.grams::float8 AS used, l.stock_delta < l.grams AS short, us.current_amount::float8 AS current
                              FROM usage_log l JOIN user_strain us ON us.strain_id = l.strain_id AND us.user_id = l.user_id
                              WHERE l.user_id = ${user.id}::int AND l.request_id = ${rid}::text AND l.strain_id = ${id}::int` : [];
  if (dup) return NextResponse.json({ id: dup.id, current: dup.current, used: dup.used, stockShort: !!dup.short });
  return bad('Nie znaleziono odmiany.', 404); // usunięta w międzyczasie (albo requestId użyty przy innej odmianie)
});

// „Cofnij” po zapisie: usuwa własny wpis z ostatnich 10 minut i oddaje do stanu dokładnie to, co odjęto,
// w jednym zapytaniu (DELETE ... RETURNING, więc podwójne cofnięcie oddaje tylko raz)
export const DELETE = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const entryId = intId((await req.json().catch(() => ({}))).id);
  if (!entryId) return bad('Błędny identyfikator wpisu.');
  const [row] = await sql()`WITH d AS (
      DELETE FROM usage_log WHERE id = ${entryId}::int AND user_id = ${user.id}::int AND strain_id = ${id}::int
        AND stock_delta IS NOT NULL AND created_at > now() - interval '10 minutes'
      RETURNING grams, stock_delta
    ), upd AS (
      UPDATE user_strain us SET current_amount = us.current_amount + d.stock_delta, updated_at = now()
      FROM d WHERE us.strain_id = ${id}::int AND us.user_id = ${user.id}::int
      RETURNING us.current_amount
    )
    SELECT d.grams::float8 AS grams, upd.current_amount::float8 AS current FROM d LEFT JOIN upd ON TRUE`;
  if (!row) return bad('Tego zapisu nie można już cofnąć.', 404);
  return NextResponse.json({ current: row.current ?? 0, used: -row.grams });
});
