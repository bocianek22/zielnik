import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { parseCommon, parseNumber } from '@/lib/strains';

const dec = (v) => String(v ?? '').trim().replace(',', '.');

// Import odmian z CSV (maks. 200 wierszy). Istniejące (ta sama nazwa i producent) są pomijane.
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { rows } = await req.json().catch(() => ({}));
  if (!Array.isArray(rows) || !rows.length) return bad('Brak wierszy do importu.');
  const q = sql();
  let added = 0, skipped = 0;
  const errors = [];

  for (const r of rows.slice(0, 200)) {
    const { error, fields: f } = await parseCommon({
      name: r.name, producer: r.producer, type: r.type, kind: r.kind, thc: dec(r.thc), cbd: dec(r.cbd), price: dec(r.price),
      batch: r.batch, expires: r.expires, form: String(r.form ?? '').trim(), taste: r.taste, finalRating: dec(r.finalRating),
      terpenes: String(r.terpenes ?? '').split(/[,;]/).map((t) => t.trim()).filter(Boolean),
    });
    if (error) { errors.push(`${r.name || '(pusty wiersz)'}: ${error}`); continue; }
    const dup = await q`SELECT 1 FROM strains WHERE lower(name) = lower(${f.name}) AND lower(producer) = lower(${f.producer})`;
    if (dup.length) { skipped++; continue; }

    const [s] = await q`INSERT INTO strains (producer, name, type, final_rating, taste, thc, cbd, kind, terpenes, description, price_per_g, batch, expires_on, form, created_by)
      VALUES (${f.producer}, ${f.name}, ${f.type}, ${f.finalRating}, ${f.taste}, ${f.thc}, ${f.cbd}, ${f.kind},
              ${JSON.stringify(f.terpenes)}::jsonb, '', ${f.price}, ${f.batch}, ${f.expires}::date, ${f.form}, ${user.id}) RETURNING id`;
    await q`INSERT INTO user_strain (strain_id, user_id) SELECT ${s.id}, id FROM users ON CONFLICT DO NOTHING`;

    const rating = parseNumber(dec(r.rating), 0, 10);
    const current = parseNumber(dec(r.current), 0, 100000);
    const remaining = parseNumber(dec(r.remaining), 0, 100000);
    await q`UPDATE user_strain SET rating = ${Number.isNaN(rating) ? null : rating}::numeric,
              rated_at = CASE WHEN ${Number.isNaN(rating) ? null : rating}::numeric IS NULL THEN NULL ELSE now() END,
              current_amount = ${Number.isNaN(current) || current == null ? 0 : current},
              notes = ${String(r.notes ?? '').trim().slice(0, 1000)}
            WHERE strain_id = ${s.id} AND user_id = ${user.id}`;
    if (remaining > 0) {
      await q`INSERT INTO user_pool (user_id, pool_key, remaining_to_buy)
              SELECT ${user.id}::int, pool_key(s.id, s.producer, s.thc, s.cbd), ${remaining}::numeric FROM strains s WHERE s.id = ${s.id}
              ON CONFLICT (user_id, pool_key) DO UPDATE SET remaining_to_buy = EXCLUDED.remaining_to_buy`;
    }
    added++;
  }
  return NextResponse.json({ added, skipped, errors: errors.slice(0, 10), truncated: rows.length > 200 });
});
