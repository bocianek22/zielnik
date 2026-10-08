import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { DAY_RE, markNoUse, unmarkNoUse } from '@/lib/no-use';

// POM-38: oznaczenie dnia jako „bez zużycia” i cofnięcie. Body: { day: 'YYYY-MM-DD' } (domyślnie dziś w czasie polskim).
const dayOf = async (req) => {
  const b = await jsonBody(req);
  const day = b.day == null ? new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' }) : String(b.day);
  // ścisła data: 2026-02-30 albo rok 0000 (Date je przesuwa) to 400, a nie błąd bazy
  return DAY_RE.test(day) && day >= '2000-01-01' && !Number.isNaN(Date.parse(day))
    && new Date(`${day}T00:00Z`).toISOString().slice(0, 10) === day ? day : null;
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
