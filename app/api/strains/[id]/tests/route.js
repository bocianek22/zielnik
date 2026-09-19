import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { listTests } from '@/lib/strains';

export const GET = safe(async (_req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ tests: await listTests(Number((await params).id)) });
});

// Nowy test: opis i/lub zdjęcie
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const { note, image } = await req.json().catch(() => ({}));
  const text = String(note ?? '').trim().slice(0, 1500);
  let mime = null, data = null;
  if (image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image));
    if (!m) return bad('Nieprawidłowy format zdjęcia (JPEG, PNG lub WebP).');
    if (m[2].length > 900_000) return bad('Zdjęcie jest za duże.');
    [, mime, data] = m;
  }
  if (!text && !data) return bad('Dodaj opis lub zdjęcie testu.');
  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  await sql()`INSERT INTO strain_tests (strain_id, user_id, note, mime, data) VALUES (${id}, ${user.id}, ${text}, ${mime}, ${data})`;
  return NextResponse.json({ tests: await listTests(id) });
});
