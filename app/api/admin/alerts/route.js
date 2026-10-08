import { NextResponse } from 'next/server';
import { bad, requireAdmin, safe } from '@/lib/guard';
import { alertChannels, alertThreshold, sendAlert } from '@/lib/alerts';
import { hit } from '@/lib/ratelimit';

// PLA-2: stan alertów (które kanały są skonfigurowane) i wiadomość próbna dla admina
export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ channels: alertChannels(), threshold: alertThreshold() });
});

export const POST = safe(async () => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const ch = alertChannels();
  if (!ch.webhook && !ch.email) return bad('Alerty są wyłączone: ustaw ALERT_WEBHOOK_URL albo ALERT_EMAIL (z wysyłką e-maili).', 503);
  if (!(await hit(`alert-test:${user.id}`, 3, 600))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const sent = await sendAlert('[Zielnik] Alert próbny', ['Wiadomość próbna z panelu admina. Alerty o błędach serwera działają.']);
  return NextResponse.json({ sent });
});
