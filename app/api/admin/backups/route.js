import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, safe } from '@/lib/guard';
import { saveSnapshot } from '@/lib/backup';

const list = () => sql()`SELECT id, kind, size, (blob_path IS NOT NULL) AS blob, (blob_path LIKE '%.enc') AS encrypted, to_char(created_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
                         FROM backups ORDER BY created_at DESC, id DESC`;

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ backups: await list() });
});

// Ręczne utworzenie migawki
export const POST = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  await saveSnapshot('ręczna');
  return NextResponse.json({ backups: await list() });
});
