import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { requireUser, bad, safe } from '@/lib/guard';
import { destroySession } from '@/lib/auth';

// Usunięcie własnego konta wraz z danymi (po potwierdzeniu hasłem)
export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (user.is_admin) return bad('Konta admina nie można usunąć samodzielnie. Poproś innego admina.', 403);
  const { password } = await req.json().catch(() => ({}));
  const [u] = await sql()`SELECT password_hash FROM users WHERE id = ${user.id}`;
  if (!u || !(await bcrypt.compare(String(password ?? ''), u.password_hash))) return bad('Nieprawidłowe hasło.', 403);
  await sql()`DELETE FROM strain_tests WHERE user_id = ${user.id}`;
  await sql()`UPDATE strains SET created_by = NULL WHERE created_by = ${user.id}`;
  await sql()`DELETE FROM users WHERE id = ${user.id}`; // reszta danych usuwa się kaskadowo
  await destroySession();
  return NextResponse.json({ ok: true });
});
