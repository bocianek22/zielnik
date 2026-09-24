import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';

// Statystyki serwisu (tylko liczby, bez danych zdrowotnych)
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!user.is_admin) return bad('Tylko admin.', 403);
  const [s] = await sql()`SELECT
    (SELECT count(*)::int FROM users) AS users,
    (SELECT count(*)::int FROM users WHERE plan = 'premium') AS premium,
    (SELECT count(*)::int FROM strains) AS strains,
    (SELECT count(*)::int FROM strain_tests) AS tests,
    (SELECT count(*)::int FROM groups) AS groups,
    (SELECT count(*)::int FROM friendships WHERE status = 'accepted') AS friendships,
    (SELECT count(DISTINCT user_id)::int FROM usage_log WHERE created_at > now() - interval '7 days') AS active7,
    (SELECT count(*)::int FROM reports WHERE status = 'open') AS reports,
    (SELECT count(*)::int FROM invites WHERE uses < max_uses AND (expires_at IS NULL OR expires_at > now())) AS open_invites`;
  return NextResponse.json(s);
});
