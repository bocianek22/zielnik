import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getUser, randomPassword } from '@/lib/auth';

const forbidden = () => NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });

// Reset hasła: nowe hasło tymczasowe + wymuszona zmiana przy logowaniu
export async function PATCH(_req, { params }) {
  const me = await getUser();
  if (!me?.is_admin) return forbidden();
  const id = Number((await params).id);
  if (id === me.id) {
    return NextResponse.json({ error: 'Własne hasło zmienisz w zakładce „Zmień hasło”.' }, { status: 400 });
  }
  const temp = randomPassword();
  const hash = await bcrypt.hash(temp, 10);
  const rows = await sql()`UPDATE users SET password_hash = ${hash}, must_change_password = TRUE
                           WHERE id = ${id} RETURNING id`;
  if (!rows.length) return NextResponse.json({ error: 'Nie znaleziono użytkownika.' }, { status: 404 });
  return NextResponse.json({ tempPassword: temp });
}

export async function DELETE(_req, { params }) {
  const me = await getUser();
  if (!me?.is_admin) return forbidden();
  const id = Number((await params).id);
  if (id === me.id) {
    return NextResponse.json({ error: 'Nie możesz usunąć własnego konta.' }, { status: 400 });
  }
  await sql()`DELETE FROM users WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
