import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hit } from '@/lib/ratelimit';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { listTests } from '@/lib/strains';
import { VIS_VALUES } from '@/lib/visibility';
import { putPhoto, deletePhotos } from '@/lib/photos';
import { cleanImage } from '@/lib/image-meta';
import { planNote, LOCKED_NOTE, NOTE_UNAVAILABLE_REJECT_MSG } from '@/lib/data-crypto';

const MAX_TESTS_PER_STRAIN = 50;

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
  const { note, image, visibility } = await jsonBody(req);
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
  if (text === LOCKED_NOTE) return bad('Dodaj opis lub zdjęcie testu.'); // znacznik nieczytelnej notatki nie jest treścią
  const exists = await sql()`SELECT 1 FROM strains WHERE id = ${id}`;
  if (!exists.length) return bad('Nie znaleziono odmiany.', 404);
  // testy są widoczne dla innych: limit na godzinę oraz łączna liczba testów jednego konta przy jednej odmianie
  if (!(await hit(`test-new:${user.id}`, 30, 3600))) return bad('Zbyt wiele nowych testów. Spróbuj ponownie później.', 429);
  const [{ n }] = await sql()`SELECT count(*)::int AS n FROM strain_tests WHERE strain_id = ${id} AND user_id = ${user.id}`;
  if (n >= MAX_TESTS_PER_STRAIN) return bad(`Możesz dodać najwyżej ${MAX_TESTS_PER_STRAIN} testów do jednej odmiany. Usuń starsze albo edytuj istniejące.`, 429);
  // z tokenem Blob zdjęcie leży w Blob (w bazie data = '' i blob_path), bez tokenu jako base64
  // zły format klucza: nowego opisu nie da się zapisać, odrzucamy zanim wgramy zdjęcie
  if (planNote('strain_tests', 'note', '0', text).unavailable) return bad(NOTE_UNAVAILABLE_REJECT_MSG, 422);
  const path = data ? await putPhoto(mime, data) : null;
  try {
    // AAD szyfrogramu zawiera id wiersza, więc id pobieramy z sekwencji przed INSERT (Neon HTTP nie ma interaktywnej transakcji)
    const [{ tid }] = await sql()`SELECT nextval(pg_get_serial_sequence('strain_tests', 'id'))::int AS tid`;
    await sql()`INSERT INTO strain_tests (id, strain_id, user_id, note, mime, data, visibility, blob_path)
                VALUES (${tid}, ${id}, ${user.id}, ${planNote('strain_tests', 'note', String(tid), text).value}, ${mime}, ${path ? '' : data}, COALESCE(${vis}::text, 'me'), ${path}::text)`;
  } catch (e) { await deletePhotos(path); throw e; }
  return NextResponse.json({ tests: await listTests(id, user.id) });
});
