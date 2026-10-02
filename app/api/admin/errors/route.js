import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, safe } from '@/lib/guard';

const list = () => sql()`SELECT id, source, message, digest, path,
  to_char(at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at FROM error_log ORDER BY id DESC LIMIT 50`;

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ errors: await list() });
});

export const DELETE = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  await sql()`DELETE FROM error_log`;
  return NextResponse.json({ errors: [] });
});
