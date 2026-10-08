import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { bad, requireUser, safe } from '@/lib/guard';
import { MAIL_DISABLED_MSG, mailEnabled } from '@/lib/mail';
import { normalizeEmail, sendVerification } from '@/lib/account-email';
import { hit } from '@/lib/ratelimit';

// Adres e-mail konta (KON-1): prywatny (tylko właściciel, eksport i kopia), dodawany za zgodą, używany wyłącznie
// do odzyskiwania hasła i tylko po potwierdzeniu.
export const GET = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  const [u] = await sql()`SELECT email, email_verified_at, email_consent_at FROM users WHERE id = ${user.id}`;
  return NextResponse.json({ enabled: mailEnabled(), email: u.email, verified: !!(u.email && u.email_verified_at), consentAt: u.email_consent_at });
});

// Dodanie lub zmiana adresu (także ponowne wysłanie linku). Wymaga hasła: przejęta sesja nie może podpiąć własnej
// skrzynki i resetem hasła przejąć konta na stałe. Nowy adres zawsze wymaga potwierdzenia.
export const PUT = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (!mailEnabled()) return NextResponse.json({ error: MAIL_DISABLED_MSG, disabled: true }, { status: 503 });
  const { email, consent, password } = await req.json().catch(() => ({}));
  const addr = normalizeEmail(email);
  if (!addr) return bad('Podaj poprawny adres e-mail.');
  if (consent !== true) return bad('Zaznacz zgodę na zapisanie adresu e-mail.');
  if (!(await hit(`email-set:${user.id}`, 5, 3600))) return bad('Zbyt wiele prób. Spróbuj ponownie za godzinę.', 429);
  const pwd = String(password ?? '');
  const [u] = await sql()`SELECT password_hash, email, email_verified_at FROM users WHERE id = ${user.id}`;
  if (pwd.length > 1000 || !(await bcrypt.compare(pwd, u.password_hash))) return bad('Nieprawidłowe hasło.', 403);
  if (u.email === addr && u.email_verified_at) {
    await sql()`UPDATE users SET email_consent_at = now() WHERE id = ${user.id}`;
    return NextResponse.json({ ok: true, email: addr, verified: true });
  }
  // nowy adres: potwierdzenie od nowa (wyzwalacz w bazie usuwa tokeny wysłane na poprzedni adres)
  await sql()`UPDATE users SET email = ${addr}, email_verified_at = NULL, email_consent_at = now() WHERE id = ${user.id}`;
  await sendVerification(user.id, addr);
  return NextResponse.json({ ok: true, email: addr, verified: false });
});

// Usunięcie adresu i zgody (działa także przy wyłączonej wysyłce)
export const DELETE = safe(async () => {
  const { user, res } = await requireUser();
  if (res) return res;
  await sql()`UPDATE users SET email = NULL, email_verified_at = NULL, email_consent_at = NULL WHERE id = ${user.id}`;
  await sql()`DELETE FROM email_tokens WHERE user_id = ${user.id}`;
  return NextResponse.json({ ok: true, email: null, verified: false });
});
