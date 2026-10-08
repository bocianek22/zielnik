import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { requireUser, bad, safe, jsonBody } from '@/lib/guard';
import { destroySession } from '@/lib/auth';
import { hit } from '@/lib/ratelimit';
import { deletePhotos } from '@/lib/photos';

// Usunięcie własnego konta wraz z danymi (po potwierdzeniu hasłem)
export const DELETE = safe(async (req) => {
  const { user, res } = await requireUser();
  if (res) return res;
  if (user.is_admin) return bad('Konta admina nie można usunąć samodzielnie. Poproś innego admina.', 403);
  const { password } = await jsonBody(req);
  const pwd = String(password ?? '');
  // Limit prób: przejęta sesja nie może zgadywać hasła (ani usunąć konta po jego odgadnięciu)
  if (!(await hit(`delete-account:${user.id}`, 5, 900))) return bad('Zbyt wiele prób. Spróbuj ponownie za kilka minut.', 429);
  const [u] = await sql()`SELECT password_hash FROM users WHERE id = ${user.id}`;
  // Górna granica długości jak przy logowaniu: bardzo długie dane nie trafiają do bcrypt
  if (!u || pwd.length > 1000 || !(await bcrypt.compare(pwd, u.password_hash))) return bad('Nieprawidłowe hasło.', 403);
  // Jedna transakcja: albo znika wszystko, albo nic (przerwane połączenie w połowie nie zostawia konta bez testów ani odwrotnie).
  // Pliki zdjęć w Blob kasujemy dopiero po zatwierdzeniu; gdyby to się nie udało, w bazie nie ma już na nie odwołań.
  const q = sql();
  const [gone] = await q.transaction([
    q`DELETE FROM strain_tests WHERE user_id = ${user.id} RETURNING blob_path`,
    q`UPDATE strains SET created_by = NULL WHERE created_by = ${user.id}`,
    q`DELETE FROM users WHERE id = ${user.id}`, // reszta danych usuwa się kaskadowo
  ]);
  await deletePhotos(gone.map((r) => r.blob_path));
  await destroySession();
  return NextResponse.json({ ok: true });
});
