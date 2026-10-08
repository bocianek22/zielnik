import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { bad, safe } from '@/lib/guard';
import { clientIp, hit } from '@/lib/ratelimit';
import { consumeToken } from '@/lib/account-email';

// Potwierdzenie adresu z linku (KON-1). Bez logowania: link bywa otwierany na innym urządzeniu (telefon z pocztą).
// Token jest we fragmencie adresu i idzie tylko w POST ze strony, więc skanery linków w poczcie go nie zużyją.
export const POST = safe(async (req) => {
  const { token = '' } = await req.json().catch(() => ({}));
  if (!(await hit(`verify-ip:${await clientIp()}`, 20, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const t = await consumeToken(token, 'verify');
  const ok = t && (await sql()`UPDATE users SET email_verified_at = now() WHERE id = ${t.user_id} AND email = ${t.email} RETURNING id`).length;
  if (!ok) return bad('Link wygasł albo został już użyty. Wyślij nowy w ustawieniach profilu.');
  return NextResponse.json({ ok: true });
});
