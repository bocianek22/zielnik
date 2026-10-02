import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';

// Zapis wykupu: zwiększa stan, zmniejsza pulę "do wykupienia", dopisuje wpis do historii zakupów
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const { grams } = await req.json().catch(() => ({}));
  const g = parseNumber(grams, 0.01, 100000);
  if (g == null || Number.isNaN(g)) return bad('Podaj ilość w gramach.');

  const rows = await sql()`SELECT s.name, s.price_per_g::float8 AS price
                           FROM strains s JOIN user_strain us ON us.strain_id = s.id AND us.user_id = ${user.id}
                           WHERE s.id = ${id}`;
  if (!rows.length) return bad('Nie znaleziono odmiany.', 404);
  const cost = rows[0].price != null ? Math.round(rows[0].price * g * 100) / 100 : null;

  // dodawanie w samym zapytaniu (nie z odczytanej wcześniej wartości), żeby równoległe zapisy się nie nadpisywały
  const [{ current }] = await sql()`UPDATE user_strain SET current_amount = current_amount + ${g}::numeric, updated_at = now()
                                    WHERE strain_id = ${id} AND user_id = ${user.id} RETURNING current_amount::float8 AS current`;
  const pool = await sql()`UPDATE user_pool SET remaining_to_buy = GREATEST(remaining_to_buy - ${g}::numeric, 0)
                           WHERE user_id = ${user.id}
                             AND pool_key = (SELECT pool_key(s.id, s.producer, s.thc, s.cbd) FROM strains s WHERE s.id = ${id})
                           RETURNING remaining_to_buy::float8 AS remaining`;
  await sql()`INSERT INTO purchases (user_id, strain_id, strain_name, grams, cost) VALUES (${user.id}, ${id}, ${rows[0].name}, ${g}, ${cost})`;
  return NextResponse.json({ current, remaining: pool[0]?.remaining ?? 0 });
});
