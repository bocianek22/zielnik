import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!user.is_admin) return bad('Tylko admin.', 403);
  const rows = await sql()`SELECT id, actor, action, target, details,
    to_char(at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at
    FROM audit_log ORDER BY id DESC LIMIT 50`;
  return NextResponse.json({ entries: rows });
});
