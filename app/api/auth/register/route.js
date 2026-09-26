import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { ensureDb, sql } from '@/lib/db';
import { createSession, USERNAME_RE } from '@/lib/auth';
import { clientIp, hit } from '@/lib/ratelimit';

const err = (msg, status = 400) => NextResponse.json({ error: msg }, { status });

// Rejestracja z kodem zaproszenia
export async function POST(req) {
  try {
    const b = await req.json().catch(() => ({}));
    const username = String(b.username ?? '').trim();
    const password = String(b.password ?? '');
    const code = String(b.invite ?? '').trim().toUpperCase();
    if (!b.adult || !b.consent) return err('Potwierdź pełnoletność oraz zaakceptuj regulamin i politykę prywatności.');
    if (!USERNAME_RE.test(username)) return err('Nazwa użytkownika: 3–24 znaki (litery, cyfry, kropka, _ lub -).');
    if (password.length < 8 || password.length > 100) return err('Hasło musi mieć od 8 do 100 znaków.');

    await ensureDb();
    if (!(await hit(`register-ip:${await clientIp()}`, 10, 3600))) return err('Zbyt wiele prób rejestracji. Spróbuj ponownie później.', 429);
    const q = sql();
    const dup = await q`SELECT 1 FROM users WHERE lower(username) = lower(${username})`;
    if (dup.length) return err('Ta nazwa użytkownika jest zajęta.', 409);
    // zużycie kodu jest atomowe, więc kod jednorazowy nie zadziała dwa razy
    const inv = await q`UPDATE invites SET uses = uses + 1
                        WHERE code = ${code} AND uses < max_uses AND (expires_at IS NULL OR expires_at > now()) RETURNING code`;
    if (!inv.length) return err('Nieprawidłowy, wygasły lub wykorzystany kod zaproszenia.');

    const hash = await bcrypt.hash(password, 10);
    let u;
    try {
      [u] = await q`INSERT INTO users (username, password_hash, is_admin, must_change_password, consent_at)
                          VALUES (${username}, ${hash}, FALSE, FALSE, now()) RETURNING id`;
    } catch (e) {
      await q`UPDATE invites SET uses = GREATEST(uses - 1, 0) WHERE code = ${code}`; // zwrot użycia kodu
      throw e;
    }
    await q`INSERT INTO user_strain (strain_id, user_id) SELECT id, ${u.id}::int FROM strains ON CONFLICT DO NOTHING`;
    await createSession(u.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return err('Błąd serwera. Spróbuj ponownie.', 500);
  }
}
