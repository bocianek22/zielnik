import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { listFactors, createFactor } from '@/lib/factors';

export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ factors: await listFactors(user.id) });
});

// { name } - nowy czynnik dnia (najwyżej 8 na konto)
export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const out = await createFactor(user.id, await jsonBody(req));
  if (out.error) return bad(out.error, out.status);
  return NextResponse.json({ def: out.def, factors: await listFactors(user.id) });
});
