import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { createHash, randomInt } from 'node:crypto';
import { ensureDb, sql } from './db';

const COOKIE = 'zielnik_session';
const MAX_AGE = 60 * 60 * 24 * 30;
// „Znane urządzenie” (DT-14): przeglądarka, w której ktoś już poprawnie się zalogował, omija globalny limit prób
// na nazwę użytkownika, więc rozproszony atak nie zablokuje właścicielowi logowania. Ciasteczko NIE loguje:
// hasło jest zawsze wymagane, a limity na IP i parę IP+nazwa działają dalej.
export const DEVICE_COOKIE = 'zielnik_device';
const DEVICE_AUD = 'zielnik:device';
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('Ustaw AUTH_SECRET (min. 16 znaków)');
  return new TextEncoder().encode(s);
}

// Osobny klucz dla ciasteczka urządzenia: jego token nie przejdzie weryfikacji jako sesja (i odwrotnie),
// nawet gdyby ktoś podmienił nazwy ciasteczek.
const deviceSecret = () => createHash('sha256').update(secret()).update('|zielnik-device').digest();

// `sv` = users.session_version w chwili logowania. Podniesienie wersji (zmiana/reset hasła, „wyloguj wszędzie”)
// unieważnia wszystkie wcześniej wydane tokeny.
// `device: true` (po sprawdzeniu hasła) wystawia też ciasteczko „znane urządzenie” z tą samą wersją, więc zmiana
// hasła i „wyloguj wszędzie” odbierają status znanego urządzenia wszystkim przeglądarkom.
export async function createSession(userId, { device = false } = {}) {
  await ensureDb();
  const [u] = await sql()`SELECT session_version FROM users WHERE id = ${userId}`;
  const sv = u?.session_version ?? 0;
  if (device) await rememberDevice(userId, sv);
  const token = await new SignJWT({ uid: userId, sv })
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

async function rememberDevice(userId, sv) {
  const token = await new SignJWT({ uid: userId, sv })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(DEVICE_AUD)
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(deviceSecret());
  const jar = await cookies();
  // strict + ścieżka /api/auth: potrzebne tylko przy logowaniu z własnego formularza, nie wysyłamy go z każdym żądaniem
  jar.set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: DEVICE_MAX_AGE,
  });
}

// { uid, sv } z ważnego ciasteczka urządzenia albo null. Zgodność wersji z users.session_version sprawdza wywołujący.
export async function knownDevice() {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, deviceSecret(), { audience: DEVICE_AUD, algorithms: ['HS256'] });
    return Number.isInteger(payload.uid) && Number.isInteger(payload.sv) ? { uid: payload.uid, sv: payload.sv } : null;
  } catch {
    return null;
  }
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
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (payload.aud) return null; // token sesji nigdy nie ma `aud` (ma go tylko ciasteczko urządzenia)
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
