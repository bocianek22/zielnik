import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';

// Zapis zużycia: odejmuje gramy od Twojego aktualnego stanu i dopisuje wpis do dziennika
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const { grams } = await req.json().catch(() => ({}));
  const g = parseNumber(grams, 0.01, 1000);
  if (g == null || Number.isNaN(g)) return bad('Podaj ilość w gramach (0,01–1000).');

  const q = sql();
  const exists = await q`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  await q`INSERT INTO user_strain (strain_id, user_id) VALUES (${id}, ${user.id}) ON CONFLICT DO NOTHING`;
  const [row] = await q`SELECT current_amount::float8 AS cur FROM user_strain WHERE strain_id = ${id} AND user_id = ${user.id}`;
  const stock = row?.cur ?? 0;
  const current = Math.max(0, Math.round((stock - g) * 100) / 100);
  await q`UPDATE user_strain SET current_amount = ${current}, updated_at = now() WHERE strain_id = ${id} AND user_id = ${user.id}`;
  await q`INSERT INTO usage_log (user_id, strain_id, grams) VALUES (${user.id}, ${id}, ${g})`;
  // zużycie zawsze trafia do dziennika, nawet gdy zapisany stan był mniejszy
  return NextResponse.json({ current, used: g, stockShort: g > stock });
});
