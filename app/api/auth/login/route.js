import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDb, sql } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { clear, clientIp, hit } from '@/lib/ratelimit';

export async function POST(req) {
  try {
    const { username = '', password = '' } = await req.json();
    await ensureDb();
    const uname = String(username).trim().toLowerCase().slice(0, 64);
    const ip = await clientIp();
    // Limity: na IP, na parę IP+nazwa (zgadywanie hasła) i wyższy na samą nazwę (atak rozproszony).
    // Ścisły limit tylko na parę, więc obcy z jednego innego IP nie zablokuje logowania właścicielowi konta;
    // atak z wielu adresów (ponad 50 prób/h na nazwę) nadal może je zablokować na godzinę (DT-14).
    if (!(await hit(`login-ip:${ip}`, 30, 900)) || !(await hit(`login-pair:${ip}|${uname}`, 8, 900))
        || !(await hit(`login-user:${uname}`, 50, 3600))) {
      return NextResponse.json({ error: 'Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.' }, { status: 429 });
    }
    const rows = await sql()`SELECT id, password_hash, must_change_password
                             FROM users WHERE lower(username) = lower(${String(username).trim()})`;
    const u = rows[0];
    const ok = u && (await bcrypt.compare(String(password), u.password_hash));
    if (!ok) {
      return NextResponse.json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło.' }, { status: 401 });
    }
    await clear(`login-pair:${ip}|${uname}`);
    await createSession(u.id);
    return NextResponse.json({ ok: true, mustChange: u.must_change_password });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd serwera. Sprawdź konfigurację (DATABASE_URL, AUTH_SECRET).' }, { status: 500 });
  }
}
