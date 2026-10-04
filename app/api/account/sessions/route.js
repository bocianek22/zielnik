import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { bad, requireUser, safe } from '@/lib/guard';
import { currentSessionId, revokeOtherSessions } from '@/lib/auth';
import { hit } from '@/lib/ratelimit';

// Zalogowane urządzenia (POM-27): tylko aktywne sesje własnego konta, „current” = to urządzenie
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const cur = await currentSessionId();
  const rows = await sql()`SELECT id, device, native, country, created_at, last_used_at FROM sessions
                           WHERE user_id = ${user.id} AND revoked_at IS NULL AND expires_at > now()
                           ORDER BY last_used_at DESC, created_at DESC`;
  return NextResponse.json({ sessions: rows.map((s) => ({ ...s, current: s.id === cur })) });
});

// Wyloguj inne urządzenia (to zostaje zalogowane)
export const DELETE = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!(await hit(`sessions:${user.id}`, 30, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  await revokeOtherSessions(user.id);
  return NextResponse.json({ ok: true });
});
