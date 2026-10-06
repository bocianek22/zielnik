import { NextResponse } from 'next/server';
import { requireUser, bad, safe } from '@/lib/guard';
import { listCustom, createCustom } from '@/lib/symptoms-custom';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ custom: await listCustom(user.id) });
});

// { name, higherBetter } - nowy własny objaw (najwyżej 3 na konto)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const out = await createCustom(user.id, b);
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ def: out.def, custom: await listCustom(user.id) });
});
