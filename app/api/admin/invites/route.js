import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { randomPassword } from '@/lib/auth';

async function admin() {
  const r = await requireUser();
  if (r.res) return r;
  if (!r.user.is_admin) return { res: bad('Tylko admin.', 403) };
  return r;
}
const list = () => sql()`SELECT code, note, max_uses, uses,
  to_char(expires_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS expires_at FROM invites ORDER BY created_at DESC LIMIT 50`;

export const GET = safe(async () => {
  const { res } = await admin();
  if (res) return res;
  return NextResponse.json({ invites: await list() });
});

// { note, maxUses (1-100), days (0-90; 0 = bez terminu) }
export const POST = safe(async (req) => {
  const { user, res } = await admin();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const maxUses = Math.min(100, Math.max(1, Number(b.maxUses) || 1));
  const days = Math.min(90, Math.max(0, Number(b.days) || 0));
  const code = randomPassword(10).toUpperCase();
  await sql()`INSERT INTO invites (code, created_by, note, max_uses, expires_at)
              VALUES (${code}, ${user.id}, ${String(b.note ?? '').trim().slice(0, 80)}, ${maxUses},
                      ${days ? new Date(Date.now() + days * 864e5).toISOString() : null}::timestamptz)`;
  return NextResponse.json({ invites: await list() });
});

export const DELETE = safe(async (req) => {
  const { res } = await admin();
  if (res) return res;
  const { code } = await req.json().catch(() => ({}));
  await sql()`DELETE FROM invites WHERE code = ${String(code ?? '')}`;
  return NextResponse.json({ invites: await list() });
});
