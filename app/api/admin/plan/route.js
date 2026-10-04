import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdmin, bad, safe, intId } from '@/lib/guard';
import { logAudit } from '@/lib/audit';

const list = () => sql()`SELECT id, username, plan, to_char(plan_until AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS plan_until
                         FROM users ORDER BY (plan = 'premium') DESC, lower(username)`;

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ users: await list() });
});

// { userId, plan: 'free' | 'premium', days? } - ręczne nadanie lub cofnięcie Premium
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  if (!['free', 'premium'].includes(b.plan)) return bad('Nieprawidłowy plan.');
  const days = Math.min(3650, Math.max(0, Number(b.days) || 0));
  const [t] = await sql()`SELECT username FROM users WHERE id = ${intId(b.userId)}`;
  await logAudit(user.username, `ustawił plan: ${b.plan}${days ? ` (${days} dni)` : ''}`, t?.username);
  await sql()`UPDATE users SET plan = ${b.plan},
      plan_until = ${b.plan === 'premium' && days ? new Date(Date.now() + days * 864e5).toISOString() : null}::timestamptz
    WHERE id = ${intId(b.userId)}`;
  return NextResponse.json({ users: await list() });
});
