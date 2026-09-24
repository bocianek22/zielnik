import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { listStrains, listOptions, parseCommon } from '@/lib/strains';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const [strains, options] = await Promise.all([listStrains(user.id), listOptions()]);
  return NextResponse.json({ strains, options });
});

export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { error, fields: f } = await parseCommon(await req.json().catch(() => ({})));
  if (error) return bad(error);
  const q = sql();
  const [row] = await q`INSERT INTO strains (producer, name, type, final_rating, taste, thc, cbd, kind, terpenes, description, price_per_g, batch, expires_on, form, sources, description_auto, created_by)
                        VALUES (${f.producer}, ${f.name}, ${f.type}, ${f.finalRating}, ${f.taste}, ${f.thc}, ${f.cbd}, ${f.kind},
                                ${JSON.stringify(f.terpenes)}::jsonb, ${f.description}, ${f.price}, ${f.batch}, ${f.expires}::date, ${f.form}, ${JSON.stringify(f.sources)}::jsonb, ${f.descriptionAuto}, ${user.id})
                        RETURNING id`;
  // Automatycznie utwórz osobiste pola (ocena, ilości, spostrzeżenia) dla każdego użytkownika
  await q`INSERT INTO user_strain (strain_id, user_id) SELECT ${row.id}, id FROM users ON CONFLICT DO NOTHING`;
  return NextResponse.json({ id: row.id });
});
