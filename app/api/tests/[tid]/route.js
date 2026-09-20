import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { listTests } from '@/lib/strains';
import { VIS_VALUES } from '@/lib/visibility';

// Edycja własnego testu: { note, visibility, image? (nowe zdjęcie), removePhoto? }
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const tid = Number((await params).tid);
  const b = await req.json().catch(() => ({}));
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
    photo = m;
  }
  const willHavePhoto = photo ? true : b.removePhoto ? false : t.has;
  if (!text && !willHavePhoto) return bad('Test musi mieć opis lub zdjęcie.');

  const q = sql();
  await q`UPDATE strain_tests SET note = ${text}, visibility = COALESCE(${vis}::text, visibility), updated_at = now() WHERE id = ${tid}`;
  if (photo) await q`UPDATE strain_tests SET mime = ${photo[1]}, data = ${photo[2]} WHERE id = ${tid}`;
  else if (b.removePhoto) await q`UPDATE strain_tests SET mime = NULL, data = NULL WHERE id = ${tid}`;
  return NextResponse.json({ tests: await listTests(t.strain_id, user.id) });
});

// Usunięcie testu: autor lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const tid = Number((await params).tid);
  const rows = await sql()`SELECT user_id FROM strain_tests WHERE id = ${tid}`;
  if (!rows.length) return bad('Nie znaleziono testu.', 404);
  if (!user.is_admin && rows[0].user_id !== user.id) return bad('Test może usunąć jego autor lub admin.', 403);
  await sql()`DELETE FROM strain_tests WHERE id = ${tid}`;
  return NextResponse.json({ ok: true });
});
