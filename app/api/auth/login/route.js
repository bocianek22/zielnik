import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDb, sql } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { clear, clientIp, hit } from '@/lib/ratelimit';

export async function POST(req) {
  try {
    const { username = '', password = '' } = await req.json();
    await ensureDb();
    const uname = String(username).trim().toLowerCase();
    const ip = await clientIp();
    if (!(await hit(`login-ip:${ip}`, 30, 900)) || !(await hit(`login-user:${uname}`, 8, 900))) {
      return NextResponse.json({ error: 'Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.' }, { status: 429 });
    }
    const rows = await sql()`SELECT id, password_hash, must_change_password
                             FROM users WHERE lower(username) = lower(${String(username).trim()})`;
    const u = rows[0];
    const ok = u && (await bcrypt.compare(String(password), u.password_hash));
    if (!ok) {
      return NextResponse.json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło.' }, { status: 401 });
    }
    await clear(`login-user:${uname}`);
    await createSession(u.id);
    return NextResponse.json({ ok: true, mustChange: u.must_change_password });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd serwera. Sprawdź konfigurację (DATABASE_URL, AUTH_SECRET).' }, { status: 500 });
  }
}
