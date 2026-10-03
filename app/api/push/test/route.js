import { NextResponse } from 'next/server';
import { bad, requireUser, safe } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { NOT_CONFIGURED, TEST_PAYLOAD, deliver, pushConfig } from '@/lib/push';

// Testowe powiadomienie na wszystkie urządzenia użytkownika
export const POST = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!pushConfig().any) return bad(NOT_CONFIGURED, 503);
  if (!(await hit(`push-test:${user.id}`, 5, 600))) return bad('Za dużo prób. Spróbuj za kilka minut.', 429);
  const r = await deliver(user.id, TEST_PAYLOAD);
  if (r.ok === 0 && r.skipped && !r.failed && !r.removed) return bad(NOT_CONFIGURED, 503);
  if (r.ok === 0) return bad(r.removed ? 'Subskrypcja wygasła. Wyłącz i włącz powiadomienia ponownie.' : 'Nie udało się wysłać powiadomienia na żadne urządzenie.', 502);
  return NextResponse.json({ ok: true, ...r });
});
