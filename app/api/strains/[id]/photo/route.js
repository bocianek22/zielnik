import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { putPhoto, deletePhotos, photoResponse } from '@/lib/photos';
import { cleanImage } from '@/lib/image-meta';

const MAX_CHARS = 900_000; // ok. 650 KB po zakodowaniu
const NO_RIGHTS = 'Zdjęcie tej odmiany może zmienić lub usunąć tylko osoba, która je dodała, autor odmiany albo admin.';

export const GET = safe(async (_req, { params }) => {
  const { res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const rows = await sql()`SELECT mime, data, blob_path FROM strain_photos WHERE strain_id = ${id}`;
  if (!rows.length) return new Response('Brak zdjęcia', { status: 404 });
  return photoResponse(rows[0]);
});

// Zdjęcie jest wspólne: każdy może je dodać, gdy go brak, ale podmienić lub usunąć istniejące może tylko
// osoba, która je dodała, autor odmiany albo admin (zdjęcia sprzed kolumny uploaded_by: autor odmiany lub admin).
export const PUT = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const { image } = await req.json().catch(() => ({}));
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image || ''));
  if (!m) return bad('Nieprawidłowy format zdjęcia (JPEG, PNG lub WebP).');
  if (m[2].length > MAX_CHARS) return bad('Zdjęcie jest za duże.');
  const img = cleanImage(m[1], m[2]); // bez EXIF (GPS) i innych metadanych
  if (img.error) return bad(img.error);
  const [s] = await sql()`SELECT created_by FROM strains WHERE id = ${id}`;
  if (!s) return bad('Nie znaleziono odmiany.', 404);
  const privileged = user.is_admin || s.created_by === user.id;
  // Z tokenem Blob: obiekt zapisujemy przed wpisem w bazie (nowa losowa ścieżka), a gdy zapis się nie uda
  // albo brakuje uprawnień, sprzątamy go. Bez tokenu path = null i zdjęcie ląduje w bazie jako base64.
  const path = await putPhoto(img.mime, img.b64);
  try {
    // Sprawdzenie uprawnień w tym samym poleceniu co zapis, więc dwa równoczesne „dodaj” nie nadpiszą się po cichu.
    // Stara ścieżka (do usunięcia z Blob) pochodzi ze stanu sprzed zapisu (CTE).
    const rows = await sql()`WITH old AS (SELECT blob_path FROM strain_photos WHERE strain_id = ${id})
              INSERT INTO strain_photos (strain_id, mime, data, uploaded_by, blob_path)
              VALUES (${id}, ${img.mime}, ${path ? '' : img.b64}, ${user.id}, ${path}::text)
              ON CONFLICT (strain_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, uploaded_by = EXCLUDED.uploaded_by,
                blob_path = EXCLUDED.blob_path, updated_at = now(),
                credit = NULL, license = NULL, license_url = NULL, source_url = NULL
              WHERE ${privileged}::boolean OR strain_photos.uploaded_by = ${user.id}
              RETURNING strain_id, (SELECT blob_path FROM old) AS old_path`;
    if (!rows.length) { await deletePhotos(path); return bad(NO_RIGHTS, 403); }
    await deletePhotos(rows[0].old_path);
  } catch (e) { await deletePhotos(path); throw e; }
  return NextResponse.json({ ok: true });
});

export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const [s] = await sql()`SELECT created_by FROM strains WHERE id = ${id}`;
  const privileged = user.is_admin || (!!s && s.created_by === user.id);
  const del = await sql()`DELETE FROM strain_photos WHERE strain_id = ${id}
                          AND (${privileged}::boolean OR uploaded_by = ${user.id}) RETURNING strain_id, blob_path`;
  await deletePhotos(del.map((r) => r.blob_path));
  if (!del.length && (await sql()`SELECT 1 FROM strain_photos WHERE strain_id = ${id}`).length) return bad(NO_RIGHTS, 403);
  return NextResponse.json({ ok: true });
});
