import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDb, sql } from '@/lib/db';
import { createSession, knownDevice } from '@/lib/auth';
import { clear, clientIp, hit } from '@/lib/ratelimit';

// Górna granica tylko przeciw bardzo długim danym (bcrypt i tak bierze 72 bajty). Nowe hasła mają limit 100 znaków,
// tu zapas, żeby nie odciąć kont z dłuższym hasłem tymczasowym nadanym przed wprowadzeniem limitu.
const MAX_PASSWORD = 1000;

export async function POST(req) {
  try {
    const { username = '', password = '' } = await req.json();
    await ensureDb();
    const uname = String(username).trim().toLowerCase().slice(0, 64);
    const ip = await clientIp();
    const rows = await sql()`SELECT id, password_hash, must_change_password, session_version
                             FROM users WHERE lower(username) = lower(${String(username).trim()})`;
    const u = rows[0];
    // Limity: na IP, na parę IP+nazwa (zgadywanie hasła) i wyższy na samą nazwę (atak rozproszony).
    // Ścisły limit tylko na parę, więc obcy z jednego innego IP nie zablokuje logowania właścicielowi konta.
    // Limitu na nazwę nie stosujemy dla „znanego urządzenia” (ważne ciasteczko tego konta z aktualną wersją
    // sesji), więc atak z wielu adresów nie zablokuje właściciela w jego przeglądarce (DT-14); jego próby nie
    // zużywają też tego limitu. Hasło jest sprawdzane zawsze.
    const dev = await knownDevice();
    const known = !!(dev && u && dev.uid === u.id && dev.sv === u.session_version);
    if (!(await hit(`login-ip:${ip}`, 30, 900)) || !(await hit(`login-pair:${ip}|${uname}`, 8, 900))
        || (!known && !(await hit(`login-user:${uname}`, 50, 3600)))) {
      return NextResponse.json({ error: 'Zbyt wiele prób logowania. Spróbuj ponownie za kilka minut.' }, { status: 429 });
    }
    const pwd = String(password);
    const ok = u && pwd.length <= MAX_PASSWORD && (await bcrypt.compare(pwd, u.password_hash));
    if (!ok) {
      return NextResponse.json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło.' }, { status: 401 });
    }
    await clear(`login-pair:${ip}|${uname}`);
    await createSession(u.id, { device: true });
    return NextResponse.json({ ok: true, mustChange: u.must_change_password });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd serwera. Sprawdź konfigurację (DATABASE_URL, AUTH_SECRET).' }, { status: 500 });
  }
}
