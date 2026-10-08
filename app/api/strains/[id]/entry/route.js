import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';
import { VIS_VALUES } from '@/lib/visibility';
import { openEditable, rowScope, NOTE_UNAVAILABLE_MSG } from '@/lib/data-crypto';
import { planNoteDb } from '@/lib/notes';

// Zapis osobistych pól zalogowanego użytkownika: ocena, obecna ilość, do wykupienia, spostrzeżenia
export const PUT = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const b = await req.json().catch(() => ({}));

  const rating = parseNumber(b.rating, 0, 10);
  // ilości są opcjonalne: brak pola = bez zmian (autozapis innych pól nie może nadpisać stanu zmienionego
  // w międzyczasie przez szybkie zużycie/wykup)
  const hasCurrent = b.current !== undefined, hasRemaining = b.remaining !== undefined;
  const current = hasCurrent ? parseNumber(b.current, 0, 100000) ?? 0 : null;
  const remaining = hasRemaining ? parseNumber(b.remaining, 0, 100000) ?? 0 : null;
  if (Number.isNaN(rating)) return bad('Ocena musi być liczbą od 0 do 10.');
  if (Number.isNaN(current) || Number.isNaN(remaining)) return bad('Ilości muszą być liczbami nieujemnymi.');
  const notes = String(b.notes ?? '').trim().slice(0, 1000);
  const price = parseNumber(b.price, 0, 10000);
  if (Number.isNaN(price)) return bad('Cena musi być liczbą od 0 do 10000.');
  const vis = VIS_VALUES.includes(b.visibility) ? b.visibility : null;

  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);

  // notatka: nieczytelny szyfrogram i znacznik od klienta nie nadpisują zapisanej wartości (planNote)
  const scope = rowScope('user_strain', { user_id: user.id, strain_id: id });
  const plan = await planNoteDb('user_strain', 'notes', { strain_id: id, user_id: user.id }, scope, notes);
  // rated_at zmienia się tylko, gdy zmieniła się sama ocena (na tym opierają się rankingi tygodniowe i miesięczne)
  const [e] = await sql()`
    INSERT INTO user_strain (strain_id, user_id, rating, rated_at, current_amount, notes, visibility, price_per_g)
    VALUES (${id}, ${user.id}, ${rating}::numeric, CASE WHEN ${rating}::numeric IS NULL THEN NULL ELSE now() END,
            COALESCE(${current}::numeric, 0), ${plan.value}, COALESCE(${vis}::text, 'me'), ${price})
    ON CONFLICT (strain_id, user_id) DO UPDATE SET
      rated_at = CASE WHEN EXCLUDED.rating IS NULL THEN NULL
                      WHEN user_strain.rating IS DISTINCT FROM EXCLUDED.rating THEN now()
                      ELSE user_strain.rated_at END,
      rating = EXCLUDED.rating,
      current_amount = COALESCE(${current}::numeric, user_strain.current_amount),
      notes = CASE WHEN ${plan.keep}::boolean THEN user_strain.notes ELSE EXCLUDED.notes END,
      visibility = COALESCE(${vis}::text, user_strain.visibility),
      price_per_g = EXCLUDED.price_per_g,
      updated_at = now()
    RETURNING rating::float8 AS rating, rated_at AS "ratedAt", current_amount::float8 AS current, notes, price_per_g::float8 AS price`;

  // "Do wykupienia" jest wspólne dla puli (ten sam producent, THC i CBD) i osobiste dla użytkownika
  if (hasRemaining) {
    await sql()`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
                SELECT ${user.id}::int, pool_key(s.id, s.producer, s.thc, s.cbd, s.form), ${remaining}::numeric FROM strains s WHERE s.id = ${id}
                ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = EXCLUDED.remaining_to_buy`;
  }
  // z ceną za gram: ile własnych zakupów tej odmiany nie ma kosztu (karta proponuje ich uzupełnienie)
  const missingCost = price > 0
    ? (await sql()`SELECT count(*)::int AS n FROM purchases WHERE user_id = ${user.id}::int AND strain_id = ${id}::int AND cost IS NULL`)[0].n
    : 0;
  const { current: cur, ...rest } = openEditable('user_strain', 'notes', scope, e, 'notes');
  // niewysłanych ilości nie odsyłamy, żeby spóźniona odpowiedź nie cofnęła w UI stanu po szybkiej akcji
  return NextResponse.json({ entry: { ...rest, ...(hasCurrent && { current: cur }), ...(hasRemaining && { remaining }),
    ratedAt: e.ratedAt ? new Date(e.ratedAt).toISOString() : null }, missingCost,
    ...(plan.unavailable && { noteError: NOTE_UNAVAILABLE_MSG }) });
});
