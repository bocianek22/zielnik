import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, requireAdmin, bad, safe, intId, jsonBody } from '@/lib/guard';
import { listHistory, updateStrain, EDIT_FIELDS } from '@/lib/strains';

export const GET = safe(async (_req, { params }) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const id = intId((await params).id);
  if (!(await sql()`SELECT 1 FROM strains WHERE id = ${id}`).length) return bad('Nie znaleziono odmiany.', 404);
  return NextResponse.json({ history: await listHistory(id, user.id) });
});

// Przywrócenie starych wartości pól z wpisu historii (tylko admin); tworzy nowy wpis historii
export const POST = safe(async (req, { params }) => {
  const { user, res } = await requireAdmin('Przywracać zmiany może tylko admin.');
  if (res) return res;
  const id = intId((await params).id);
  const body = await jsonBody(req);
  const editId = intId(body.editId);
  const [edit] = await sql()`SELECT changes FROM strain_edits WHERE id = ${editId} AND strain_id = ${id}`;
  if (!edit) return bad('Nie znaleziono wpisu historii.', 404);
  const fields = {};
  for (const [col, [old]] of Object.entries(edit.changes)) {
    const key = EDIT_FIELDS[col];
    if (key) fields[key] = old;
  }
  if (!await updateStrain(id, fields, user.id)) return bad('Nie znaleziono odmiany.', 404);
  return NextResponse.json({ ok: true });
});
