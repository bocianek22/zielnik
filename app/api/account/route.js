import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { destroySession } from '@/lib/auth';
import { hit } from '@/lib/ratelimit';

// Usunięcie własnego konta wraz z danymi (po potwierdzeniu hasłem)
export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (user.is_admin) return bad('Konta admina nie można usunąć samodzielnie. Poproś innego admina.', 403);
  const { password } = await req.json().catch(() => ({}));
  const pwd = String(password ?? '');
  // Limit prób: przejęta sesja nie może zgadywać hasła (ani usunąć konta po jego odgadnięciu)
  if (!(await hit(`delete-account:${user.id}`, 5, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const [u] = await sql()`SELECT password_hash FROM users WHERE id = ${user.id}`;
  // Górna granica długości jak przy logowaniu: bardzo długie dane nie trafiają do bcrypt
  if (!u || pwd.length > 1000 || !(await bcrypt.compare(pwd, u.password_hash))) return bad('Nieprawidłowe hasło.', 403);
  await sql()`DELETE FROM strain_tests WHERE user_id = ${user.id}`;
  await sql()`UPDATE strains SET created_by = NULL WHERE created_by = ${user.id}`;
  await sql()`DELETE FROM users WHERE id = ${user.id}`; // reszta danych usuwa się kaskadowo
  await destroySession();
  return NextResponse.json({ ok: true });
});
