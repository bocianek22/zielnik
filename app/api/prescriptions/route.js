import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { parseNumber } from '@/lib/strains';
import { normUnit } from '@/lib/units';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const list = (me) => sql()`
  SELECT p.id, to_char(p.issued_on, 'YYYY-MM-DD') AS issued_on, to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
         p.grams::float8 AS grams, p.unit, p.note,
         COALESCE((SELECT SUM(pu.grams) FROM purchases pu WHERE pu.user_id = p.user_id AND strain_unit(pu.strain_id) = p.unit
           AND (pu.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN p.issued_on AND COALESCE(p.valid_until, DATE '9999-12-31')), 0)::float8 AS bought
  FROM prescriptions p WHERE p.user_id = ${me}::int ORDER BY p.issued_on DESC, p.id DESC`;

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ prescriptions: await list(user.id) });
});

// { issuedOn, validUntil?, grams, unit? ('g' | 'ml'), note? }
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const issued = String(b.issuedOn ?? '');
  const valid = String(b.validUntil ?? '') || null;
  const grams = parseNumber(b.grams, 0.1, 100000);
  if (!DATE.test(issued) || Number.isNaN(Date.parse(issued))) return bad('Podaj datę wystawienia.');
  if (valid && (!DATE.test(valid) || Number.isNaN(Date.parse(valid)) || valid < issued)) return bad('Data ważności musi być późniejsza niż wystawienia.');
  if (grams == null || Number.isNaN(grams)) return bad('Podaj przepisaną ilość (g lub ml).');
  await sql()`INSERT INTO prescriptions (user_id, issued_on, valid_until, grams, unit, note)
              VALUES (${user.id}, ${issued}::date, ${valid}::date, ${grams}, ${normUnit(b.unit)}, ${String(b.note ?? '').trim().slice(0, 120)})`;
  return NextResponse.json({ prescriptions: await list(user.id) });
});

export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { id } = await req.json().catch(() => ({}));
  await sql()`DELETE FROM prescriptions WHERE id = ${intId(id)} AND user_id = ${user.id}`;
  return NextResponse.json({ prescriptions: await list(user.id) });
});
