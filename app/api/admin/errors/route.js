import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

async function admin() {
  const r = await requireUser();
  if (r.res) return r;
  if (!r.user.is_admin) return { res: bad('Tylko admin.', 403) };
  return r;
}
const list = () => sql()`SELECT id, source, message, digest, path,
  to_char(at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') AS at FROM error_log ORDER BY id DESC LIMIT 50`;

export const GET = safe(async () => {
  const { res } = await admin();
  if (res) return res;
  return NextResponse.json({ errors: await list() });
});

export const DELETE = safe(async () => {
  const { res } = await admin();
  if (res) return res;
  await sql()`DELETE FROM error_log`;
  return NextResponse.json({ errors: [] });
});
