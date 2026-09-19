import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';

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

  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);

  // rated_at zmienia się tylko, gdy zmieniła się sama ocena (na tym opierają się rankingi tygodniowe i miesięczne)
  const [e] = await sql()`
    INSERT INTO user_strain (strain_id, user_id, rating, rated_at, current_amount, remaining_to_buy, notes)
    VALUES (${id}, ${user.id}, ${rating}::numeric, CASE WHEN ${rating}::numeric IS NULL THEN NULL ELSE now() END,
            ${current}, ${remaining}, ${notes})
    ON CONFLICT (strain_id, user_id) DO UPDATE SET
      rated_at = CASE WHEN EXCLUDED.rating IS NULL THEN NULL
                      WHEN user_strain.rating IS DISTINCT FROM EXCLUDED.rating THEN now()
                      ELSE user_strain.rated_at END,
      rating = EXCLUDED.rating,
      current_amount = EXCLUDED.current_amount,
      remaining_to_buy = EXCLUDED.remaining_to_buy,
      notes = EXCLUDED.notes,
      updated_at = now()
    RETURNING rating::float8 AS rating, rated_at AS "ratedAt", current_amount::float8 AS current,
              remaining_to_buy::float8 AS remaining, notes`;
  return NextResponse.json({ entry: { ...e, ratedAt: e.ratedAt ? new Date(e.ratedAt).toISOString() : null } });
});
