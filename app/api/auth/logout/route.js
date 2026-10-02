import { NextResponse } from 'next/server';
import { destroySession, getUser, revokeSessions } from '@/lib/auth';

// { all: true } - wylogowanie ze wszystkich urządzeń (unieważnia wszystkie wydane sesje)
export async function POST(req) {
  const { all } = await req.json().catch(() => ({}));
  if (all === true) {
    const me = await getUser();
    if (me) await revokeSessions(me.id);
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
