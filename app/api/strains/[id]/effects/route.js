import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { EFFECTS } from '@/lib/effects';
import { parseNumber } from '@/lib/strains';

// Zapis Twojej skali odczuć dla odmiany
export const PUT = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const { effects } = await req.json().catch(() => ({}));
  const clean = {};
  for (const [key] of EFFECTS) {
    const v = parseNumber(effects?.[key], 0, 10);
    if (Number.isNaN(v)) return bad('Odczucia muszą być liczbami od 0 do 10.');
    if (v != null) clean[key] = v;
  }
  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  await sql()`INSERT INTO user_strain (strain_id, user_id, effects) VALUES (${id}, ${user.id}, ${JSON.stringify(clean)}::jsonb)
              ON CONFLICT (strain_id, user_id) DO UPDATE SET effects = EXCLUDED.effects, updated_at = now()`;
  return NextResponse.json({ effects: clean });
});
