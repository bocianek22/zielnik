import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getUser, randomPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { intId } from '@/lib/guard';

const forbidden = () => NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });

// Reset hasła: nowe hasło tymczasowe + wymuszona zmiana przy logowaniu
export async function PATCH(_req, { params }) {
  const me = await getUser();
  if (!me?.is_admin) return forbidden();
  const id = intId((await params).id);
  if (id === me.id) {
    return NextResponse.json({ error: 'Własne hasło zmienisz w zakładce „Zmień hasło”.' }, { status: 400 });
  }
  const temp = randomPassword();
  const hash = await bcrypt.hash(temp, 10);
  const rows = await sql()`UPDATE users SET password_hash = ${hash}, must_change_password = TRUE
                           WHERE id = ${id} RETURNING id, username`;
  if (!rows.length) return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 });
  await logAudit(me.username, 'zresetował hasło', rows[0].username);
  return NextResponse.json({ tempPassword: temp });
}

export async function DELETE(_req, { params }) {
  const me = await getUser();
  if (!me?.is_admin) return forbidden();
  const id = intId((await params).id);
  if (id === me.id) {
    return NextResponse.json({ error: 'Nie możesz usunąć własnego konta.' }, { status: 400 });
  }
  const [target] = await sql()`SELECT username, is_admin FROM users WHERE id = ${id}`;
  if (!target) return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 });
  if (target.is_admin) {
    return NextResponse.json({ error: 'Konta administratora nie można usunąć.' }, { status: 403 });
  }
  await sql()`DELETE FROM users WHERE id = ${id}`;
  await logAudit(me.username, 'usunął konto', target.username);
  return NextResponse.json({ ok: true });
}
