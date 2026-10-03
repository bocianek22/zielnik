import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { parseNumber } from '@/lib/strains';
import { MAX_COST } from '@/lib/corrections';

// Uzupełnienie kosztu własnych zakupów odmiany, które go nie mają (np. cenę wpisano dopiero po wykupie)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const strainId = intId(b.strainId);
  const price = parseNumber(b.pricePerG, 0.01, 10000);
  if (!strainId) return bad('Nie znaleziono odmiany.', 404);
  if (price == null || Number.isNaN(price)) return bad('Podaj cenę za gram (0,01–10000 zł).');
  const rows = await sql()`UPDATE purchases SET cost = round(grams * ${price}::numeric, 2)
                           WHERE user_id = ${user.id}::int AND strain_id = ${strainId}::int AND cost IS NULL
                             AND grams * ${price}::numeric <= ${MAX_COST}::numeric
                           RETURNING id`;
  if (rows.length) await logAudit(user.username, 'uzupełnienie kosztów zakupów', `strain:${strainId}`, `${rows.length} zakupów po ${price} zł/g`);
  return NextResponse.json({ filled: rows.length });
});
