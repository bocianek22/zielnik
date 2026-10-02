import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomInt } from 'node:crypto';
import { ensureDb, sql } from './db';

const COOKIE = 'zielnik_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('Ustaw AUTH_SECRET (min. 16 znaków)');
  return new TextEncoder().encode(s);
}

// `sv` = users.session_version w chwili logowania. Podniesienie wersji (zmiana/reset hasła, „wyloguj wszędzie”)
// unieważnia wszystkie wcześniej wydane tokeny.
export async function createSession(userId) {
  await ensureDb();
  const [u] = await sql()`SELECT session_version FROM users WHERE id = ${userId}`;
  const token = await new SignJWT({ uid: userId, sv: u?.session_version ?? 0 })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

// Unieważnia wszystkie sesje użytkownika (na wszystkich urządzeniach).
export async function revokeSessions(userId) {
  await sql()`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId}`;
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUser() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    await ensureDb();
    const rows = await sql()`SELECT id, username, is_admin, must_change_password, session_version
                             FROM users WHERE id = ${payload.uid}`;
    const u = rows[0];
    // Tokeny sprzed wprowadzenia `sv` liczą się jako wersja 0, więc wdrożenie nikogo nie wylogowuje.
    if (!u || (payload.sv ?? 0) !== u.session_version) return null;
    const { session_version, ...user } = u;
    return user;
  } catch {
    return null;
  }
}

export function randomPassword(len = 10) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[randomInt(chars.length)];
  return out;
}

export const USERNAME_RE = /^[\p{L}\p{N}._-]{3,24}$/u;
