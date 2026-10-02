import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseCommon } from '@/lib/strains';

// Edycja pól wspólnych (dostępna dla każdego zalogowanego)
export const PATCH = safe(async (req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const { error, fields: f } = await parseCommon(await req.json().catch(() => ({})));
  if (error) return bad(error);
  // Zmiana producenta/THC/CBD zmienia klucz puli "do wykupienia" (pool_key), więc w tym samym zapytaniu
  // przenosimy wartości wszystkich osób na nowy klucz. Gdy inna odmiana nadal ma stary klucz, stara pula
  // zostaje, a nowa dostaje tylko kopię (jeśli jej jeszcze nie ma). Przy kolizji z istniejącą nową pulą
  // bierzemy większą wartość (GREATEST), jak migracja w init(): to ta sama recepta, więc sumowanie
  // liczyłoby ją podwójnie.
  const rows = await sql()`WITH old AS (
      SELECT id, pool_key(id, producer, thc, cbd) AS k FROM strains WHERE id = ${id} FOR UPDATE
    ), upd AS (
      UPDATE strains s SET producer = ${f.producer}, name = ${f.name}, type = ${f.type},
             final_rating = ${f.finalRating}, taste = ${f.taste}, thc = ${f.thc}, cbd = ${f.cbd},
             kind = ${f.kind}, terpenes = ${JSON.stringify(f.terpenes)}::jsonb, description = ${f.description},
             price_per_g = ${f.price}, batch = ${f.batch}, expires_on = ${f.expires}::date, form = ${f.form}, sources = ${JSON.stringify(f.sources)}::jsonb, description_auto = ${f.descriptionAuto}
      FROM old WHERE s.id = old.id
      RETURNING s.id, old.k AS old_key, pool_key(s.id, s.producer, s.thc, s.cbd) AS new_key
    ), mv AS (
      SELECT u.old_key, u.new_key,
             EXISTS (SELECT 1 FROM strains o WHERE o.id <> u.id AND pool_key(o.id, o.producer, o.thc, o.cbd) = u.old_key) AS shared
      FROM upd u WHERE u.old_key <> u.new_key
    ), moved AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT up.user_id, mv.new_key, up.remaining_to_buy FROM user_pool up JOIN mv ON up.pool_key = mv.old_key WHERE NOT mv.shared
      ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = GREATEST(user_pool.remaining_to_buy, EXCLUDED.remaining_to_buy)
    ), copied AS (
      INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
      SELECT up.user_id, mv.new_key, up.remaining_to_buy FROM user_pool up JOIN mv ON up.pool_key = mv.old_key WHERE mv.shared
      ON CONFLICT (user_id, pool_key) DO NOTHING
    ), dropped AS (
      DELETE FROM user_pool up USING mv WHERE up.pool_key = mv.old_key AND NOT mv.shared
    )
    SELECT id FROM upd`;
  if (!rows.length) return bad('Nie znaleziono odmiany.', 404);
  return NextResponse.json({ ok: true });
});

// Usunięcie: twórca odmiany lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const found = await sql()`SELECT created_by FROM strains WHERE id = ${id}`;
  if (!found.length) return bad('Nie znaleziono odmiany.', 404);
  if (!user.is_admin && found[0].created_by !== user.id) {
    return bad('Odmianę może usunąć jej twórca lub admin.', 403);
  }
  // usunięcie kasuje kaskadowo oceny, testy i dziennik zużycia wszystkich osób, więc twórca może usunąć
  // tylko odmianę, której nikt inny jeszcze nie używa
  if (!user.is_admin) {
    const [o] = await sql()`SELECT
        EXISTS (SELECT 1 FROM user_strain WHERE strain_id = ${id} AND user_id <> ${user.id}
                AND (rating IS NOT NULL OR notes <> '' OR effects <> '{}'::jsonb OR current_amount > 0)) OR
        EXISTS (SELECT 1 FROM usage_log WHERE strain_id = ${id} AND user_id <> ${user.id}) OR
        EXISTS (SELECT 1 FROM strain_tests WHERE strain_id = ${id} AND user_id IS DISTINCT FROM ${user.id}) AS used`;
    if (o.used) return bad('Tej odmiany używają już inne osoby (oceny, zużycie lub testy). Usunąć ją może tylko admin.', 409);
  }
  await sql()`DELETE FROM strains WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
});
