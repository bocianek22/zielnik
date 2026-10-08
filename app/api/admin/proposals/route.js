import { NextResponse } from 'next/server';
import { requireAdmin, bad, safe, intId } from '@/lib/guard';
import { logAudit } from '@/lib/audit';
import { listPending, accept, reject, REASON_MAX } from '@/lib/proposals';

export const GET = safe(async () => {
  const { res } = await requireAdmin();
  if (res) return res;
  return NextResponse.json({ proposals: await listPending() });
});

// { id, action: 'accept' | 'reject', reason?, force? } - przyjęcie zapisuje zmiany jak zwykła edycja (autor: autor propozycji)
export const POST = safe(async (req) => {
  const { user, res } = await requireAdmin();
  if (res) return res;
  const b = await req.json().catch(() => ({}));
  const id = intId(b.id);
  if (!id) return bad('Nieprawidłowa propozycja.', 400);
  let r;
  if (b.action === 'accept') {
    r = await accept(id, user.id, b.force === true);
  } else if (b.action === 'reject') {
    const reason = String(b.reason ?? '').trim().slice(0, REASON_MAX);
    if (!reason) return bad('Podaj krótki powód odrzucenia.');
    r = await reject(id, user.id, reason);
  } else return bad('Nieznana akcja.');
  if (r.error === 'missing') return bad('Nie znaleziono propozycji.', 404);
  if (r.error === 'done') return bad('Ta propozycja została już rozpatrzona.', 409);
  if (r.error === 'conflict') return bad('Od czasu propozycji zmieniło się pole, którego dotyczy. Sprawdź różnice albo przyjmij mimo to.', 409);
  await logAudit(user.username, b.action === 'accept' ? 'przyjął propozycję zmiany odmiany' : 'odrzucił propozycję zmiany odmiany', String(id));
  return NextResponse.json({ ok: true, proposals: await listPending() });
});
