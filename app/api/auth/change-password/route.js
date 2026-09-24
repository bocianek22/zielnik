import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getUser } from '@/lib/auth';

export async function POST(req) {
  try {
    const me = await getUser();
    if (!me) return NextResponse.json({ error: 'Sesja wygasła. Zaloguj się ponownie.' }, { status: 401 });
    const { current = '', password = '' } = await req.json();
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Nowe hasło musi mieć co najmniej 8 znaków.' }, { status: 400 });
    }
    const rows = await sql()`SELECT password_hash FROM users WHERE id = ${me.id}`;
    if (!(await bcrypt.compare(String(current), rows[0].password_hash))) {
      return NextResponse.json({ error: 'Obecne hasło jest nieprawidłowe.' }, { status: 400 });
    }
    if (current === password) {
      return NextResponse.json({ error: 'Nowe hasło musi się różnić od obecnego.' }, { status: 400 });
    }
    const hash = await bcrypt.hash(String(password), 10);
    await sql()`UPDATE users SET password_hash = ${hash}, must_change_password = FALSE WHERE id = ${me.id}`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
