import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, intId, jsonBody } from '@/lib/guard';
import { parseCommon, updateStrain, invalidateStrains } from '@/lib/strains';
import { deletePhotos } from '@/lib/photos';
import { hit } from '@/lib/ratelimit';
import { editMode, createProposal, MAX_PENDING } from '@/lib/proposals';

// Edycja pól wspólnych: bezpośrednio tylko admin i twórca odmiany, dopóki nikt inny jej nie używa (KAT-1).
// Każdy inny zalogowany tworzy propozycję zmiany, którą rozpatruje admin.
export const PATCH = safe(async (req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const mode = await editMode(user, id);
  if (!mode) return bad('Nie znaleziono odmiany.', 404);
  // propozycja nie dopisuje nowych producentów, typów ani terpenów do wspólnych list (robi to dopiero akceptacja)
  const { error, fields: f } = await parseCommon(await jsonBody(req), { newOptions: mode === 'direct' });
  if (error) return bad(error);
  if (mode === 'direct') {
    const row = await updateStrain(id, f, user.id);
    if (!row) return bad('Nie znaleziono odmiany.', 404);
    return NextResponse.json({ ok: true });
  }
  if (!(await hit(`proposal:${user.id}`, 30, 3600))) return bad('Zbyt wiele propozycji w krótkim czasie. Spróbuj ponownie za godzinę.', 429);
  const p = await createProposal(id, user.id, f);
  if (p.error === 'limit') return bad(`Masz już ${MAX_PENDING} propozycji czekających na decyzję. Poczekaj na odpowiedź albo wycofaj którąś.`, 409);
  // bez zmian pól (np. tylko nowe zdjęcie): nic do akceptacji, formularz wgra samo zdjęcie
  if (p.error === 'nochange') return NextResponse.json({ ok: true, unchanged: true });
  return NextResponse.json({ ok: true, proposal: true, id: p.id }, { status: 202 });
});

// Usunięcie: twórca odmiany lub admin
export const DELETE = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  const found = await sql()`SELECT created_by FROM strains WHERE id = ${id}`;
  if (!found.length) return bad('Nie znaleziono odmiany.', 404);
  if (!user.is_admin && found[0].created_by !== user.id) {
    return bad('Odmianę może usunąć jej twórca lub admin.', 403);
  }
  // zdjęcia w Blob usuwamy dopiero po skasowaniu odmiany (kaskada usuwa wiersze zdjęć i testów)
  const blobs = (await sql()`SELECT blob_path FROM strain_photos WHERE strain_id = ${id} AND blob_path IS NOT NULL
                             UNION ALL SELECT blob_path FROM strain_tests WHERE strain_id = ${id} AND blob_path IS NOT NULL`).map((r) => r.blob_path);
  if (user.is_admin) {
    await sql()`DELETE FROM strains WHERE id = ${id}`;
    invalidateStrains();
    await deletePhotos(blobs);
    return NextResponse.json({ ok: true });
  }
  // usunięcie kasuje kaskadowo oceny, testy i dziennik zużycia wszystkich osób, więc twórca może usunąć
  // tylko odmianę, której nikt inny jeszcze nie używa; sprawdzenie i usunięcie w jednym zapytaniu
  const del = await sql()`DELETE FROM strains WHERE id = ${id} AND NOT strain_used_by_others(${id}::int, ${user.id}::int)
    RETURNING id`;
  if (!del.length) return bad('Tej odmiany używają już inne osoby (oceny, zakupy, zużycie lub testy). Usunąć ją może tylko admin.', 409);
  invalidateStrains();
  await deletePhotos(blobs);
  return NextResponse.json({ ok: true });
});
