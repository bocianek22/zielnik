import { NextResponse } from 'next/server';
import { bad, safe, jsonBody } from '@/lib/guard';
import { clientIp, hit } from '@/lib/ratelimit';
import { MAIL_DISABLED_MSG, digest, mailEnabled } from '@/lib/mail';
import { RESET_SENT_MSG, padResponse, requestReset } from '@/lib/account-email';

// „Nie pamiętam hasła” (KON-1). Odpowiedź nie zdradza, czy konto lub adres istnieje: zawsze ten sam komunikat
// i podobny czas (wysyłka po odpowiedzi, wyrównanie czasu). 429 tylko z limitów niezależnych od istnienia konta
// (IP i wpisany tekst); limity konta i adresu działają po cichu w requestReset.
export const POST = safe(async (req) => {
  const start = Date.now();
  if (!mailEnabled()) return NextResponse.json({ error: MAIL_DISABLED_MSG, disabled: true }, { status: 503 });
  const { login = '' } = await jsonBody(req);
  const ident = String(login ?? '').trim().toLowerCase();
  if (!ident || ident.length > 254) return bad('Podaj nazwę użytkownika lub adres e-mail.');
  const ip = await clientIp();
  if (!(await hit(`forgot-ip:${ip}`, 10, 900)) || !(await hit(`forgot-id:${digest(ident)}`, 5, 3600))) {
    return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  }
  await requestReset(ident);
  await padResponse(start);
  return NextResponse.json({ ok: true, message: RESET_SENT_MSG });
});
