import { NextResponse } from 'next/server';
import { requireUser, bad, safe } from '@/lib/guard';
import { DAY_RE, markNoUse, unmarkNoUse } from '@/lib/no-use';

// POM-38: oznaczenie dnia jako „bez zużycia” i cofnięcie. Body: { day: 'YYYY-MM-DD' } (domyślnie dziś w czasie polskim).
const dayOf = async (req) => {
  const b = await req.json().catch(() => ({}));
  const day = b.day == null ? new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }) : String(b.day);
  return DAY_RE.test(day) && !Number.isNaN(Date.parse(day)) ? day : null;
};

export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const day = await dayOf(req);
  if (!day) return bad('Nieprawidłowa data.');
  const r = await markNoUse(user.id, day);
  if (r.error) return bad(r.error, r.status);
  return NextResponse.json({ ok: true, day });
});

export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  const day = await dayOf(req);
  if (!day) return bad('Nieprawidłowa data.');
  await unmarkNoUse(user.id, day);
  return NextResponse.json({ ok: true, day });
});
