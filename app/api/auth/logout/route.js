import { NextResponse } from 'next/server';
import { safe } from '@/lib/guard';
import { destroySession, getUser, revokeSessions } from '@/lib/auth';

// { all: true } - wylogowanie ze wszystkich urządzeń (unieważnia wszystkie wydane sesje)
export const POST = safe(async (req) => {
  const { all } = (await req.json().catch(() => null)) || {};
  if (all === true) {
    const me = await getUser();
    if (me) await revokeSessions(me.id);
  }
  await destroySession();
  return NextResponse.json({ ok: true });
});
