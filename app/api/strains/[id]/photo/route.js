import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

const MAX_CHARS = 900_000; // ok. 650 KB po zakodowaniu

export const GET = safe(async (_req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const rows = await sql()`SELECT mime, data FROM strain_photos WHERE strain_id = ${id}`;
  if (!rows.length) return new Response('Brak zdjęcia', { status: 404 });
  return new Response(Buffer.from(rows[0].data, 'base64'), {
    headers: { 'Content-Type': rows[0].mime, 'Cache-Control': 'private, max-age=31536000, immutable' },
  });
});

export const PUT = safe(async (req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  const id = Number((await params).id);
  const { image } = await req.json().catch(() => ({}));
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ''));
  if (!m) return bad('Nieprawidłowy format zdjęcia (JPEG, PNG lub WebP).');
  if (m[2].length > MAX_CHARS) return bad('Zdjęcie jest za duże.');
  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  await sql()`INSERT INTO strain_photos (strain_id, mime, data) VALUES (${id}, ${m[1]}, ${m[2]})
              ON CONFLICT (strain_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = now()`;
  return NextResponse.json({ ok: true });
});

export const DELETE = safe(async (_req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  await sql()`DELETE FROM strain_photos WHERE strain_id = ${Number((await params).id)}`;
  return NextResponse.json({ ok: true });
});
