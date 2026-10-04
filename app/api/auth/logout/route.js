import { NextResponse } from 'next/server';
import { safe } from '@/lib/guard';
import { destroySession, getUser, revokeSessions } from '@/lib/auth';
import { deleteSubscription, fcmEndpoint } from '@/lib/push';

// { all: true } - wylogowanie ze wszystkich urządzeń (unieważnia wszystkie wydane sesje)
// { pushEndpoint, fcmToken } - przy okazji usuwa subskrypcję push / token FCM tego urządzenia (tylko własne)
export const POST = safe(async (req) => {
  const { all, pushEndpoint, fcmToken } = (await req.json().catch(() => null)) || {};
  const fcm = fcmEndpoint(fcmToken);
  const me = all === true || typeof pushEndpoint === 'string' || fcm ? await getUser() : null;
  if (me && all === true) await revokeSessions(me.id);
  if (me && typeof pushEndpoint === 'string' && pushEndpoint) await deleteSubscription(me.id, pushEndpoint);
  if (me && fcm) await deleteSubscription(me.id, fcm);
  await destroySession();
  return NextResponse.json({ ok: true });
});
