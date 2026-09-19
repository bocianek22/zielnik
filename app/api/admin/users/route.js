import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { getUser, randomPassword, USERNAME_RE } from '@/lib/auth';

const forbidden = () => NextResponse.json({ error: 'Brak uprawnień.' }, { status: 403 });

export async function GET() {
  const me = await getUser();
  if (!me?.is_admin) return forbidden();
  const users = await sql()`SELECT id, username, is_admin, must_change_password, created_at
                            FROM users ORDER BY created_at, id`;
  return NextResponse.json({ users });
}

export async function POST(req) {
  try {
    const me = await getUser();
    if (!me?.is_admin) return forbidden();
    const { username = '', password = '' } = await req.json();
    const name = String(username).trim();
    if (!USERNAME_RE.test(name)) {
      return NextResponse.json({ error: 'Nazwa: 3–24 znaki (litery, cyfry, . _ -).' }, { status: 400 });
    }
    const temp = String(password).trim() || randomPassword();
    if (temp.length < 8) {
      return NextResponse.json({ error: 'Hasło tymczasowe musi mieć co najmniej 8 znaków.' }, { status: 400 });
    }
    const hash = await bcrypt.hash(temp, 10);
    let row;
    try {
      [row] = await sql()`INSERT INTO users (username, password_hash, is_admin, must_change_password)
                          VALUES (${name}, ${hash}, FALSE, TRUE)
                          RETURNING id, username, is_admin, must_change_password, created_at`;
    } catch (e) {
      if (e?.code === '23505') {
        return NextResponse.json({ error: 'Taki użytkownik już istnieje.' }, { status: 409 });
      }
      throw e;
    }
    // Automatycznie utwórz osobiste pola (ocena, ilości, spostrzeżenia) dla wszystkich istniejących odmian
    await sql()`INSERT INTO user_strain (strain_id, user_id)
                SELECT id, ${row.id} FROM strains ON CONFLICT DO NOTHING`;
    return NextResponse.json({ user: row, tempPassword: temp });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Błąd serwera.' }, { status: 500 });
  }
}
