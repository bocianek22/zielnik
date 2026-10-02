import { NextResponse } from 'next/server';
import { bad, requireUser, safe } from '@/lib/guard';
import { NOT_CONFIGURED, deleteSubscription, fcmEndpoint, parseFcmToken, parseSubscription, pushConfig, saveSubscription } from '@/lib/push';

// Zapis subskrypcji tego urządzenia (idempotentne: odświeżane też przy otwarciu aplikacji i ustawień).
// claim: true przy świadomym włączeniu - przejmuje urządzenie, jeśli było przypisane do innego konta.
// owned: false, gdy urządzenie należy do innego konta (wtedy nic nie zmieniono).
// kind 'fcm' (aplikacja natywna, mobile/README.md): { kind: 'fcm', token, claim }; nie wymaga kluczy VAPID.
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const body = await req.json().catch(() => ({}));
  if (body.kind === 'fcm') {
    const t = parseFcmToken(body);
    if (t.error) return bad(t.error);
    return NextResponse.json({ ok: true, owned: await saveSubscription(user.id, 'fcm', t.endpoint, t.keys, body.claim === true) });
  }
  if (!pushConfig().enabled) return bad(NOT_CONFIGURED, 503);
  if ((body.kind ?? 'webpush') !== 'webpush') return bad('Nieobsługiwany rodzaj powiadomień.');
  const s = parseSubscription(body);
  if (s.error) return bad(s.error);
  return NextResponse.json({ ok: true, owned: await saveSubscription(user.id, 'webpush', s.endpoint, s.keys, body.claim === true) });
});

// Wyłączenie powiadomień na tym urządzeniu (tylko własna subskrypcja); aplikacja natywna: { kind: 'fcm', token }
export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const body = await req.json().catch(() => ({}));
  const endpoint = body.kind === 'fcm' ? fcmEndpoint(body.token) : body.endpoint;
  if (typeof endpoint !== 'string' || !endpoint) return bad('Brak adresu subskrypcji.');
  return NextResponse.json({ ok: true, removed: await deleteSubscription(user.id, endpoint) });
});
