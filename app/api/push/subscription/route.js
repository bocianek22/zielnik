import { NextResponse } from 'next/server';
import { bad, requireUser, safe } from '@/lib/guard';
import { NOT_CONFIGURED, deleteSubscription, parseSubscription, pushConfig, saveSubscription } from '@/lib/push';

// Zapis subskrypcji tego urządzenia (idempotentne: odświeżane też przy otwarciu aplikacji i ustawień).
// claim: true przy świadomym włączeniu - przejmuje urządzenie, jeśli było przypisane do innego konta.
// owned: false, gdy urządzenie należy do innego konta (wtedy nic nie zmieniono).
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!pushConfig().enabled) return bad(NOT_CONFIGURED, 503);
  const body = await req.json().catch(() => ({}));
  if ((body.kind ?? 'webpush') !== 'webpush') return bad('Nieobsługiwany rodzaj powiadomień.');
  const s = parseSubscription(body);
  if (s.error) return bad(s.error);
  return NextResponse.json({ ok: true, owned: await saveSubscription(user.id, 'webpush', s.endpoint, s.keys, body.claim === true) });
});

// Wyłączenie powiadomień na tym urządzeniu (tylko własna subskrypcja)
export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const { endpoint } = await req.json().catch(() => ({}));
  if (typeof endpoint !== 'string' || !endpoint) return bad('Brak adresu subskrypcji.');
  return NextResponse.json({ ok: true, removed: await deleteSubscription(user.id, endpoint) });
});
