import { NextResponse } from 'next/server';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { hit } from '@/lib/ratelimit';
import { addMed, listMeds } from '@/lib/other-meds';

// Inne przyjmowane leki (prywatne): lista do raportu dla lekarza
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  return NextResponse.json({ meds: await listMeds(user.id) });
});

export const POST = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  // dodawanie i usuwanie w pętli omija limit liczby leków, więc osobny limit zapisów
  if (!(await hit(`other-med:${user.id}`, 60, 3600))) return bad('Zbyt wiele zapisów. Spróbuj ponownie później.', 429);
  const r = await addMed(user.id, await jsonBody(req));
  if (r.error) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ meds: await listMeds(user.id) });
});
