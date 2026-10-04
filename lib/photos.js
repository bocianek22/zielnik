import { randomUUID } from 'node:crypto';

// Zdjęcia odmian i testów w prywatnym Vercel Blob (gdy jest BLOB_READ_WRITE_TOKEN). W bazie zostaje tylko ścieżka
// (blob_path), a kolumna data = '' (puste, ale nie NULL, bo "ma zdjęcie" w zapytaniach to data IS NOT NULL).
// Obiekty są prywatne, a odczyt idzie przez trasy API z kontrolą uprawnień. Bez tokenu zdjęcia są base64 w bazie.
export const PHOTO_PREFIX = 'zielnik-photos/';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;
// Zapis nowych zdjęć do Blob wymaga dodatkowo PHOTOS_BLOB=1 (opt-in); odczyt i usuwanie istniejących blob_path działa z samym tokenem
export const blobWriteEnabled = () => blobEnabled() && process.env.PHOTOS_BLOB === '1';

// Ładowany leniwie, żeby kod bez tokenu nie dotykał paczki
const client = () => import('@vercel/blob');

// Ścieżka z losowym id, bez nazwy odmiany ani identyfikatorów w środku
export const photoPath = (mime) => `${PHOTO_PREFIX}${randomUUID()}.${EXT[mime] || 'bin'}`;

// Zapisuje zdjęcie w Blob i zwraca ścieżkę; bez tokenu zwraca null (wtedy zapis base64 do bazy).
export async function putPhoto(mime, b64) {
  if (!blobWriteEnabled()) return null;
  const { put } = await client();
  const path = photoPath(mime);
  await put(path, Buffer.from(b64, 'base64'), {
    access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN, contentType: mime, addRandomSuffix: false, allowOverwrite: false,
  });
  return path;
}

// Odczyt zdjęcia z Blob jako Buffer (null, gdy obiektu nie ma: get() zwraca wtedy null; brak tokenu też daje null)
export async function readPhoto(path) {
  if (!blobEnabled()) { console.error('Zdjęcie leży w Vercel Blob, a brakuje BLOB_READ_WRITE_TOKEN:', path); return null; }
  const { get } = await client();
  const f = await get(path, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN, useCache: false });
  if (!f || f.statusCode !== 200) return null;
  return Buffer.from(await new Response(f.stream).arrayBuffer());
}

// Usuwa obiekty z Blob (best effort: błąd tylko logujemy, żeby nie psuć operacji na bazie)
export async function deletePhotos(paths) {
  const list = [...new Set([].concat(paths || []).filter(Boolean))];
  if (!list.length || !blobEnabled()) return;
  try {
    const { del } = await client();
    await del(list, { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (e) {
    console.error('Nie udało się usunąć zdjęć z Blob:', list.length, e?.message || e);
  }
}

// Odpowiedź HTTP ze zdjęciem z bazy (base64) albo z Blob; cache prywatny (tylko przeglądarka zalogowanego)
export async function photoResponse(row) {
  let body;
  if (row.blob_path) {
    body = await readPhoto(row.blob_path);
    if (!body) return new Response('Brak zdjęcia', { status: 404 });
  } else body = Buffer.from(row.data, 'base64');
  // Vary: Cookie - inna sesja w tej samej przeglądarce (wspólny telefon) nie dostanie zdjęcia z pamięci podręcznej
  return new Response(body, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=31536000, immutable', Vary: 'Cookie' } });
}
