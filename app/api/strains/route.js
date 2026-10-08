import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { listStrains, listStrainsPage, strainIndexPage, listOptions, parseCommon, parsePaging, invalidateStrains } from '@/lib/strains';

// bez parametrów: cała lista (zgodność ze starszymi klientami); ?limit=&cursor= (strona listy, najwyżej PAGE_MAX; `next` to kursor kolejnej strony albo null),
// ?view=index (lekka lista: id, nazwa, producent, postać, jednostka, smak i moje „mam”, do podpowiedzi i wyborów)
export const GET = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const params = new URL(req.url).searchParams;
  const { error, limit, after, paged } = parsePaging(params);
  if (error) return bad(error);
  if (params.get('view') === 'index') return NextResponse.json(await strainIndexPage(user.id, { limit, after }));
  const [{ strains, next }, options] = await Promise.all([
    paged ? listStrainsPage(user.id, { limit, after }) : listStrains(user.id).then((s) => ({ strains: s.map(({ cur: _c, ...x }) => x), next: null })),
    listOptions(),
  ]);
  return NextResponse.json({ strains, options, next });
});

export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { error, fields: f } = await parseCommon(await req.json().catch(() => ({})));
  if (error) return bad(error);
  // wpis osobisty tylko dla twórcy (w tym samym zapytaniu); inni dostają swój wiersz przy pierwszym zapisie (MOB-10)
  const [row] = await sql()`WITH s AS (
      INSERT INTO strains (producer, name, type, final_rating, taste, thc, cbd, kind, terpenes, description, price_per_g, batch, expires_on, form, sources, description_auto, created_by)
      VALUES (${f.producer}, ${f.name}, ${f.type}, ${f.finalRating}, ${f.taste}, ${f.thc}, ${f.cbd}, ${f.kind},
              ${JSON.stringify(f.terpenes)}::jsonb, ${f.description}, ${f.price}, ${f.batch}, ${f.expires}::date, ${f.form}, ${JSON.stringify(f.sources)}::jsonb, ${f.descriptionAuto}, ${user.id})
      RETURNING id)
    INSERT INTO user_strain (strain_id, user_id) SELECT id, ${user.id}::int FROM s RETURNING strain_id AS id`;
  invalidateStrains();
  return NextResponse.json({ id: row.id });
});
