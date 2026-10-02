import { NextResponse } from 'next/server';
import { safe } from '@/lib/guard';
import { destroySession, getUser, revokeSessions } from '@/lib/auth';
import { deleteSubscription } from '@/lib/push';

// { all: true } - wylogowanie ze wszystkich urządzeń (unieważnia wszystkie wydane sesje)
// { pushEndpoint } - przy okazji usuwa subskrypcję push tego urządzenia (tylko własną)
export const POST = safe(async (req) => {
  const { all, pushEndpoint } = (await req.json().catch(() => null)) || {};
  const me = all === true || typeof pushEndpoint === 'string' ? await getUser() : null;
  if (me && all === true) await revokeSessions(me.id);
  if (me && typeof pushEndpoint === 'string' && pushEndpoint) await deleteSubscription(me.id, pushEndpoint);
  await destroySession();
  return NextResponse.json({ ok: true });
});
