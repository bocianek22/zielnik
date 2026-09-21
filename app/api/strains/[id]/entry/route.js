import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';
import { VIS_VALUES } from '@/lib/visibility';

// Zapis osobistych pól zalogowanego użytkownika: ocena, obecna ilość, do wykupienia, spostrzeżenia
export const PUT = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const b = await req.json().catch(() => ({}));

  const rating = parseNumber(b.rating, 0, 10);
  const current = parseNumber(b.current, 0, 100000) ?? 0;
  const remaining = parseNumber(b.remaining, 0, 100000) ?? 0;
  if (Number.isNaN(rating)) return bad('Ocena musi być liczbą od 0 do 10.');
  if (Number.isNaN(current) || Number.isNaN(remaining)) return bad('Ilości muszą być liczbami nieujemnymi.');
  const notes = String(b.notes ?? '').trim().slice(0, 1000);
  const price = parseNumber(b.price, 0, 10000);
  if (Number.isNaN(price)) return bad('Cena musi być liczbą od 0 do 10000.');
  const vis = VIS_VALUES.includes(b.visibility) ? b.visibility : null;

  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);

  // rated_at zmienia się tylko, gdy zmieniła się sama ocena (na tym opierają się rankingi tygodniowe i miesięczne)
  const [e] = await sql()`
    INSERT INTO user_strain (strain_id, user_id, rating, rated_at, current_amount, notes, visibility, price_per_g)
    VALUES (${id}, ${user.id}, ${rating}::numeric, CASE WHEN ${rating}::numeric IS NULL THEN NULL ELSE now() END,
            ${current}, ${notes}, COALESCE(${vis}::text, 'me'), ${price})
    ON CONFLICT (strain_id, user_id) DO UPDATE SET
      rated_at = CASE WHEN EXCLUDED.rating IS NULL THEN NULL
                      WHEN user_strain.rating IS DISTINCT FROM EXCLUDED.rating THEN now()
                      ELSE user_strain.rated_at END,
      rating = EXCLUDED.rating,
      current_amount = EXCLUDED.current_amount,
      notes = EXCLUDED.notes,
      visibility = COALESCE(${vis}::text, user_strain.visibility),
      price_per_g = EXCLUDED.price_per_g,
      updated_at = now()
    RETURNING rating::float8 AS rating, rated_at AS "ratedAt", current_amount::float8 AS current, notes, price_per_g::float8 AS price`;

  // "Do wykupienia" jest wspólne dla puli (ten sam producent, THC i CBD) i osobiste dla użytkownika
  await sql()`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
              SELECT ${user.id}::int, pool_key(s.id, s.producer, s.thc, s.cbd), ${remaining}::numeric FROM strains s WHERE s.id = ${id}
              ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = EXCLUDED.remaining_to_buy`;
  return NextResponse.json({ entry: { ...e, remaining, ratedAt: e.ratedAt ? new Date(e.ratedAt).toISOString() : null } });
});
