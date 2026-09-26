import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { saveSnapshot } from '@/lib/backup';

async function admin() {
  const r = await requireUser();
  if (r.res) return r;
  if (!r.user.is_admin) return { res: bad('Tylko admin.', 403) };
  return r;
}
const list = () => sql()`SELECT id, kind, size, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
                         FROM backups ORDER BY created_at DESC, id DESC`;

export const GET = safe(async () => {
  const { res } = await admin();
  if (res) return res;
  return NextResponse.json({ backups: await list() });
});

// Ręczne utworzenie migawki
export const POST = safe(async () => {
  const { res } = await admin();
  if (res) return res;
  await saveSnapshot('ręczna');
  return NextResponse.json({ backups: await list() });
});
