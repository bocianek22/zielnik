import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';

// Zapis zużycia: odejmuje gramy od Twojego aktualnego stanu i dopisuje wpis do dziennika
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const { grams } = await req.json().catch(() => ({}));
  const g = parseNumber(grams, 0.01, 1000);
  if (g == null || Number.isNaN(g)) return bad('Podaj ilość w gramach (0,01–1000).');

  const q = sql();
  const exists = await q`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  await q`INSERT INTO user_strain (strain_id, user_id) VALUES (${id}, ${user.id}) ON CONFLICT DO NOTHING`;
  // odczyt i zapis stanu w jednym zapytaniu (z blokadą wiersza), żeby dwa szybkie zapisy (np. podwójne
  // dotknięcie) nie nadpisały się nawzajem
  const [row] = await q`WITH old AS (SELECT current_amount FROM user_strain WHERE strain_id = ${id} AND user_id = ${user.id} FOR UPDATE)
    UPDATE user_strain us SET current_amount = GREATEST(old.current_amount - ${g}::numeric, 0), updated_at = now()
    FROM old WHERE us.strain_id = ${id} AND us.user_id = ${user.id}
    RETURNING us.current_amount::float8 AS current, old.current_amount::float8 AS stock`;
  await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${user.id}, ${id}, ${g})`;
  // zużycie zawsze trafia do dziennika, nawet gdy zapisany stan był mniejszy
  return NextResponse.json({ current: row.current, used: g, stockShort: g > row.stock });
});
