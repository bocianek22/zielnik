import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { listStrains, listOptions, parseCommon } from '@/lib/strains';

export const GET = safe(async () => {
  const { res } = await requireUser();
  if (res) return res;
  const [strains, options] = await Promise.all([listStrains(), listOptions()]);
  return NextResponse.json({ strains, options });
});

export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { error, fields: f } = await parseCommon(await req.json().catch(() => ({})));
  if (error) return bad(error);
  const q = sql();
  const [row] = await q`INSERT INTO strains (producer, name, type, final_rating, taste, created_by)
                        VALUES (${f.producer}, ${f.name}, ${f.type}, ${f.finalRating}, ${f.taste}, ${user.id})
                        RETURNING id`;
  // Automatycznie utwórz osobiste pola (ocena, ilości, spostrzeżenia) dla każdego użytkownika
  await q`INSERT INTO user_strain (strain_id, user_id) SELECT ${row.id}, id FROM users ON CONFLICT DO NOTHING`;
  return NextResponse.json({ id: row.id });
});
