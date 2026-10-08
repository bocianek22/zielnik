import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { listTests } from '@/lib/strains';
import { VIS_VALUES } from '@/lib/visibility';
import { putPhoto, deletePhotos } from '@/lib/photos';
import { cleanImage } from '@/lib/image-meta';
import { NOTE_UNAVAILABLE_MSG } from '@/lib/data-crypto';
import { planNoteDb } from '@/lib/notes';

// Edycja własnego testu: { note, visibility, image? (nowe zdjęcie), removePhoto? }
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const tid = intId((await params).tid);
  const b = await jsonBody(req);
  const [t] = await sql()`SELECT user_id, strain_id, (data IS NOT NULL) AS has FROM strain_tests WHERE id = ${tid}`;
  if (!t) return bad('Nie znaleziono testu.', 404);
  if (t.user_id !== user.id) return bad('Testy edytuje tylko ich autor.', 403);

  const text = String(b.note ?? '').trim().slice(0, 1500);
  const vis = VIS_VALUES.includes(b.visibility) ? b.visibility : null;
  let photo = null;
  if (b.image) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.image));
    if (!m) return bad('Nieprawidłowy format zdjęcia (JPEG, PNG lub WebP).');
    if (m[2].length > 900_000) return bad('Zdjęcie jest za duże.');
    const img = cleanImage(m[1], m[2]); // bez EXIF (GPS) i innych metadanych
    if (img.error) return bad(img.error);
    photo = [null, img.mime, img.b64];
  }
  const willHavePhoto = photo ? true : b.removePhoto ? false : t.has;
  // nieczytelny szyfrogram i znacznik od klienta nie nadpisują zapisanej wartości (planNote); zachowana notatka liczy się jako opis
  const plan = await planNoteDb('strain_tests', 'note', { id: tid }, String(tid), text);
  if (!text && !willHavePhoto && !(plan.keep && plan.value)) return bad('Test musi mieć opis lub zdjęcie.');

  const q = sql();
  await q`UPDATE strain_tests SET note = CASE WHEN ${plan.keep}::boolean THEN note ELSE ${plan.value}::text END, visibility = COALESCE(${vis}::text, visibility), updated_at = now() WHERE id = ${tid}`;
  if (photo) {
    const path = await putPhoto(photo[1], photo[2]);
    try {
      const [o] = await q`WITH old AS (SELECT blob_path FROM strain_tests WHERE id = ${tid})
                          UPDATE strain_tests SET mime = ${photo[1]}, data = ${path ? '' : photo[2]}, blob_path = ${path}::text WHERE id = ${tid}
                          RETURNING (SELECT blob_path FROM old) AS old_path`;
      await deletePhotos(o?.old_path);
    } catch (e) { await deletePhotos(path); throw e; }
  } else if (b.removePhoto) {
    const [o] = await q`WITH old AS (SELECT blob_path FROM strain_tests WHERE id = ${tid})
                        UPDATE strain_tests SET mime = NULL, data = NULL, blob_path = NULL WHERE id = ${tid}
                        RETURNING (SELECT blob_path FROM old) AS old_path`;
    await deletePhotos(o?.old_path);
  }
  return NextResponse.json({ tests: await listTests(t.strain_id, user.id), ...(plan.unavailable && { noteError: NOTE_UNAVAILABLE_MSG }) });
});

// Usunięcie testu: autor lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const tid = intId((await params).tid);
  const rows = await sql()`SELECT user_id FROM strain_tests WHERE id = ${tid}`;
  if (!rows.length) return bad('Nie znaleziono testu.', 404);
  if (!user.is_admin && rows[0].user_id !== user.id) return bad('Test może usunąć jego autor lub admin.', 403);
  const del = await sql()`DELETE FROM strain_tests WHERE id = ${tid} RETURNING blob_path`;
  await deletePhotos(del.map((r) => r.blob_path));
  return NextResponse.json({ ok: true });
});
