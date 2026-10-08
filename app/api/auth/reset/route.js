import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { bad, safe } from '@/lib/guard';
import { revokeSessions } from '@/lib/auth';
import { clear, clientIp, hit } from '@/lib/ratelimit';
import { consumeToken } from '@/lib/account-email';

const EXPIRED = 'Link wygasł albo został już użyty. Poproś o nowy na stronie logowania.';

// Ustawienie nowego hasła z linku e-mail (KON-1). Token jednorazowy; po zmianie hasła wszystkie sesje konta są
// unieważnione (nowa wersja sesji, lista urządzeń pusta), a pozostałe tokeny resetu usuwa wyzwalacz w bazie.
// Bez automatycznego logowania: nowe logowanie hasłem tworzy świeżą sesję.
export const POST = safe(async (req) => {
  const { token = '', password = '' } = await req.json().catch(() => ({}));
  if (!(await hit(`reset-ip:${await clientIp()}`, 20, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const pwd = String(password ?? '');
  if (pwd.length < 8 || pwd.length > 100) return bad('Nowe hasło musi mieć od 8 do 100 znaków.');
  const t = await consumeToken(token, 'reset');
  if (!t) return bad(EXPIRED);
  const hash = await bcrypt.hash(pwd, 10);
  // adres musi być wciąż ten sam i potwierdzony; konto admina nigdy (token i tak nie powstaje)
  const [u] = await sql()`UPDATE users SET password_hash = ${hash}, must_change_password = FALSE
                          WHERE id = ${t.user_id} AND email = ${t.email} AND email_verified_at IS NOT NULL AND NOT is_admin
                          RETURNING id, username`;
  if (!u) return bad(EXPIRED);
  await revokeSessions(u.id);
  // właściciel po resecie nie może być zablokowany limitem prób z ataku na jego nazwę
  await clear(`login-user:${u.username.toLowerCase()}`);
  return NextResponse.json({ ok: true });
});
