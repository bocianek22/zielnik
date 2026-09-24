import { NextResponse } from 'next/server';
import { clientIp, hit } from '@/lib/ratelimit';
import { logError } from '@/lib/errorlog';

// Błędy zgłaszane przez przeglądarkę (strona błędu). Ograniczone do 20 zgłoszeń na godzinę z jednego adresu.
export async function POST(req) {
  try {
    if (!(await hit(`client-error:${await clientIp()}`, 20, 3600))) return NextResponse.json({ ok: false }, { status: 429 });
    const b = await req.json().catch(() => ({}));
    await logError('przeglądarka', String(b.message ?? '').slice(0, 300), { path: b.path, digest: b.digest ? String(b.digest).slice(0, 40) : null });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
