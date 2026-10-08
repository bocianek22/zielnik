import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId } from '@/lib/guard';
import { listTests } from '@/lib/strains';
import { VIS_VALUES } from '@/lib/visibility';
import { putPhoto, deletePhotos } from '@/lib/photos';
import { cleanImage } from '@/lib/image-meta';
import { encryptField, decryptField } from '@/lib/data-crypto';

export const GET = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ tests: await listTests(intId((await params).id), user.id) });
});

// Nowy test: opis i/lub zdjęcie
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const { note, image, visibility } = await req.json().catch(() => ({}));
  const vis = VIS_VALUES.includes(visibility) ? visibility : null;
  const text = String(note ?? '').trim().slice(0, 1500);
  let mime = null, data = null;
  if (image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(image));
    if (!m) return bad('Nieprawidłowy format zdjęcia (JPEG, PNG lub WebP).');
    if (m[2].length > 900_000) return bad('Zdjęcie jest za duże.');
    const img = cleanImage(m[1], m[2]); // bez EXIF (GPS) i innych metadanych
    if (img.error) return bad(img.error);
    ({ mime, b64: data } = img);
  }
  if (!text && !data) return bad('Dodaj opis lub zdjęcie testu.');
  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  // z tokenem Blob zdjęcie leży w Blob (w bazie data = '' i blob_path), bez tokenu jako base64
  const path = data ? await putPhoto(mime, data) : null;
  try {
    // AAD szyfrogramu zawiera id wiersza, więc id pobieramy z sekwencji przed INSERT (Neon HTTP nie ma interaktywnej transakcji)
    const [{ tid }] = await sql()`SELECT nextval(pg_get_serial_sequence('strain_tests', 'id'))::int AS tid`;
    await sql()`INSERT INTO strain_tests (id, strain_id, user_id, note, mime, data, visibility, blob_path)
                VALUES (${tid}, ${id}, ${user.id}, ${encryptField('strain_tests', 'note', tid, text)}, ${mime}, ${path ? '' : data}, COALESCE(${vis}::text, 'me'), ${path}::text)`;
  } catch (e) { await deletePhotos(path); throw e; }
  return NextResponse.json({ tests: await listTests(id, user.id) });
});
