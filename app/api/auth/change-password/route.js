import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { createSession, getUser, revokeSessions } from '@/lib/auth';
import { hit } from '@/lib/ratelimit';

export async function POST(req) {
  try {
    const me = await getUser();
    if (!me) return NextResponse.json({ error: 'Sesja wygasła. Zaloguj się ponownie.' }, { status: 401 });
    const { current = '', password = '' } = await req.json();
    // bcrypt bierze tylko 72 bajty, więc górna granica jak przy rejestracji
    if (String(password).length < 8 || String(password).length > 100) {
      return NextResponse.json({ error: 'Nowe hasło musi mieć od 8 do 100 znaków.' }, { status: 400 });
    }
    // Limit prób chroni przed zgadywaniem obecnego hasła z przejętej sesji
    if (!(await hit(`change-pw:${me.id}`, 10, 900))) {
      return NextResponse.json({ error: 'Zbyt wiele prób zmiany hasła. Spróbuj ponownie za kilka minut.' }, { status: 429 });
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
    // Wylogowanie innych urządzeń; to urządzenie dostaje nową sesję z aktualną wersją.
    await revokeSessions(me.id);
    await createSession(me.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
