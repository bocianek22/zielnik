import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

async function admin() {
  const r = await requireUser();
  if (r.res) return r;
  if (!r.user.is_admin) return { res: bad('Tylko admin.', 403) };
  return r;
}
const list = () => sql()`SELECT id, username, plan, to_char(plan_until AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS plan_until
                         FROM users ORDER BY (plan = 'premium') DESC, lower(username)`;

export const GET = safe(async () => {
  const { res } = await admin();
  if (res) return res;
  return NextResponse.json({ users: await list() });
});

// { userId, plan: 'free' | 'premium', days? } - ręczne nadanie lub cofnięcie Premium
export const POST = safe(async (req) => {
  const { res } = await admin();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (!['free', 'premium'].includes(b.plan)) return bad('Nieprawidłowy plan.');
  const days = Math.min(3650, Math.max(0, Number(b.days) || 0));
  await sql()`UPDATE users SET plan = ${b.plan},
      plan_until = ${b.plan === 'premium' && days ? new Date(Date.now() + days * 864e5).toISOString() : null}::timestamptz
    WHERE id = ${Number(b.userId)}`;
  return NextResponse.json({ users: await list() });
});
