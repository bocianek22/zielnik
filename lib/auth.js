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

export async function createSession(userId) {
  const token = await new SignJWT({ uid: userId })
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
    const rows = await sql()`SELECT id, username, is_admin, must_change_password
                             FROM users WHERE id = ${payload.uid}`;
    return rows[0] || null;
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
