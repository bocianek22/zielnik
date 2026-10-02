import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, safe } from '@/lib/guard';

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  const rows = await sql()`SELECT id, actor, action, target, details,
    to_char(at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
    FROM audit_log ORDER BY id DESC LIMIT 50`;
  return NextResponse.json({ entries: rows });
});
