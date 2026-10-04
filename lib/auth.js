import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { describeDevice, isNativeApp } from './client';
import { ensureDb, sql } from './db';

const COOKIE = 'zielnik_session';
const MAX_AGE = 60 * 60 * 24 * 30;
const MAX_SESSIONS = 50; // aktywnych sesji na konto; starsze są unieważniane przy logowaniu
// „Znane urządzenie” (DT-14): przeglądarka, w której ktoś już poprawnie się zalogował, omija globalny limit prób
// na nazwę użytkownika, więc rozproszony atak nie zablokuje właścicielowi logowania. Ciasteczko NIE loguje:
// hasło jest zawsze wymagane, a limity na IP i parę IP+nazwa działają dalej.
export const DEVICE_COOKIE = 'zielnik_device';
const DEVICE_AUD = 'zielnik:device';
const DEVICE_MAX_AGE = 60 * 60 * 24 * 365;
// Losowe `sid` ma 24 znaki base64url; identyfikator sesji sprzed POM-27 to „l” + 31 znaków skrótu tokenu.
export const SID_RE = /^[A-Za-z0-9_-]{20,64}$/;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error('Ustaw AUTH_SECRET (min. 16 znaków)');
  return new TextEncoder().encode(s);
}

// Osobny klucz dla ciasteczka urządzenia: jego token nie przejdzie weryfikacji jako sesja (i odwrotnie),
// nawet gdyby ktoś podmienił nazwy ciasteczek.
const deviceSecret = () => createHash('sha256').update(secret()).update('|zielnik-device').digest();

const nowSec = () => Math.floor(Date.now() / 1000);

// `sv` = users.session_version w chwili logowania. Podniesienie wersji (zmiana/reset hasła, „wyloguj wszędzie”)
// unieważnia wszystkie wcześniej wydane tokeny. `sid` = wiersz w `sessions` (POM-27): pozwala unieważnić jedną sesję.
// `device: true` (po sprawdzeniu hasła) wystawia też ciasteczko „znane urządzenie” z tą samą wersją, więc zmiana
// hasła i „wyloguj wszędzie” odbierają status znanego urządzenia wszystkim przeglądarkom.
export async function createSession(userId, { device = false } = {}) {
  await ensureDb();
  const [u] = await sql()`SELECT session_version FROM users WHERE id = ${userId}`;
  const sv = u?.session_version ?? 0;
  const sid = randomBytes(18).toString('base64url');
  const exp = nowSec() + MAX_AGE;
  const meta = await requestMeta();
  await sql()`INSERT INTO sessions (id, user_id, expires_at, device, native, country)
              VALUES (${sid}, ${userId}, to_timestamp(${exp}), ${meta.device}, ${meta.native}, ${meta.country})`;
  await pruneSessions(userId);
  if (device) await rememberDevice(userId, sv);
  await issue(userId, sv, sid, exp);
}

async function issue(uid, sv, sid, exp) {
  const token = await new SignJWT({ uid, sv, sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(exp)
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

// Opis urządzenia bez IP i bez pełnego User-Agent; kraj tylko z nagłówka Vercel (dwie litery).
async function requestMeta() {
  try {
    const h = await headers();
    const ua = h.get('user-agent') || '';
    const country = String(h.get('x-vercel-ip-country') || '').toUpperCase();
    return { device: describeDevice(ua), native: isNativeApp(h), country: /^[A-Z]{2}$/.test(country) ? country : null };
  } catch {
    return { device: describeDevice(''), native: false, country: null };
  }
}

// Sprzątanie przy każdym logowaniu: wygasłe wiersze wszystkich kont (indeks na expires_at) i limit aktywnych
// sesji jednego konta (najstarsze są unieważniane).
async function pruneSessions(userId) {
  await sql()`DELETE FROM sessions WHERE expires_at < now()`;
  await sql()`UPDATE sessions SET revoked_at = now()
              WHERE id IN (SELECT id FROM sessions WHERE user_id = ${userId} AND revoked_at IS NULL
                           ORDER BY created_at DESC OFFSET ${MAX_SESSIONS})`;
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

// Token z ciasteczka po sprawdzeniu podpisu (bez bazy). Tokeny sprzed POM-27 nie mają `sid`: dostają stały
// identyfikator ze skrótu tokenu, a przy pierwszym użyciu wiersz w `sessions` (getUser). Dzięki temu są na liście
// urządzeń i można je wylogować pojedynczo, a wdrożenie nikogo nie wylogowuje; same wygasają po 30 dniach.
async function readToken() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    if (payload.aud) return null; // token sesji nigdy nie ma `aud` (ma go tylko ciasteczko urządzenia)
    if (!Number.isInteger(payload.uid) || !Number.isInteger(payload.exp)) return null;
    if (payload.sid === undefined) {
      return { payload, legacy: true, sid: `l${createHash('sha256').update(token).digest('base64url').slice(0, 31)}` };
    }
    return typeof payload.sid === 'string' && SID_RE.test(payload.sid) ? { payload, legacy: false, sid: payload.sid } : null;
  } catch {
    return null;
  }
}

// Identyfikator bieżącej sesji (do oznaczenia „to urządzenie”). Celowo poza obiektem z getUser(),
// który bywa przekazywany do komponentów klienta.
export async function currentSessionId() {
  return (await readToken())?.sid ?? null;
}

// Unieważnia wszystkie sesje użytkownika (na wszystkich urządzeniach). Podniesienie wersji zabija też tokeny
// sprzed POM-27, które jeszcze nie mają wiersza w `sessions`.
export async function revokeSessions(userId) {
  await sql()`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId}`;
  await sql()`UPDATE sessions SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL`;
}

// Unieważnia jedną sesję użytkownika. false = brak takiej aktywnej sesji tego użytkownika (także cudza).
export async function revokeSession(userId, sid) {
  if (typeof sid !== 'string' || !SID_RE.test(sid)) return false;
  const rows = await sql()`UPDATE sessions SET revoked_at = now()
                           WHERE id = ${sid} AND user_id = ${userId} AND revoked_at IS NULL AND expires_at > now()
                           RETURNING id`;
  return rows.length > 0;
}

// „Wyloguj inne urządzenia” i zmiana hasła: nowa wersja sesji konta (zabija też tokeny sprzed POM-27 bez wiersza),
// wszystkie sesje poza bieżącą unieważnione. Bieżąca dostaje nowy token z tym samym `sid` (zostaje na liście
// z datą logowania) i ciasteczko znanego urządzenia z nową wersją.
export async function revokeOtherSessions(userId) {
  await ensureDb();
  const cur = await readToken();
  const keep = cur && cur.payload.uid === userId ? cur.sid : null;
  const [u] = await sql()`UPDATE users SET session_version = session_version + 1 WHERE id = ${userId} RETURNING session_version`;
  await sql()`UPDATE sessions SET revoked_at = now()
              WHERE user_id = ${userId} AND revoked_at IS NULL AND id IS DISTINCT FROM ${keep}`;
  const exp = nowSec() + MAX_AGE;
  const kept = keep ? await sql()`UPDATE sessions SET expires_at = to_timestamp(${exp}), last_used_at = now()
                                  WHERE id = ${keep} AND user_id = ${userId} AND revoked_at IS NULL RETURNING id` : [];
  if (!kept.length) return createSession(userId, { device: true });
  await rememberDevice(userId, u.session_version);
  await issue(userId, u.session_version, keep, exp);
}

// Wylogowanie z tego urządzenia: unieważnia bieżącą sesję w bazie (skopiowany wcześniej token przestaje działać)
// i usuwa ciasteczko. Token sprzed POM-27 dostaje od razu unieważniony wiersz.
export async function destroySession() {
  const cur = await readToken();
  if (cur) {
    try {
      await ensureDb();
      await sql()`INSERT INTO sessions (id, user_id, expires_at, revoked_at)
                  SELECT ${cur.sid}, id, to_timestamp(${cur.payload.exp}), now() FROM users WHERE id = ${cur.payload.uid}
                  ON CONFLICT (id) DO UPDATE SET revoked_at = COALESCE(sessions.revoked_at, now())
                  WHERE sessions.user_id = EXCLUDED.user_id`;
    } catch (e) {
      console.error(e); // ciasteczko i tak usuwamy
    }
  }
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUser() {
  const t = await readToken();
  if (!t) return null;
  try {
    await ensureDb();
    const { uid } = t.payload;
    const rows = await sql()`SELECT u.id, u.username, u.is_admin, u.must_change_password, u.session_version,
                               s.id AS sid, s.revoked_at, (s.last_used_at < now() - interval '15 minutes') AS stale
                             FROM users u LEFT JOIN sessions s ON s.id = ${t.sid} AND s.user_id = u.id
                             WHERE u.id = ${uid}`;
    const u = rows[0];
    // Tokeny sprzed wprowadzenia `sv` liczą się jako wersja 0, więc wdrożenie nikogo nie wylogowuje.
    if (!u || (t.payload.sv ?? 0) !== u.session_version) return null;
    if (u.sid) {
      if (u.revoked_at) return null;
      // ostatnie użycie najwyżej co ~15 min, żeby nie pisać do bazy przy każdym żądaniu
      if (u.stale) await sql()`UPDATE sessions SET last_used_at = now() WHERE id = ${t.sid}`;
    } else {
      // token z `sid` bez wiersza: sesja wygasła i sprzątnięta albo baza odtworzona z kopii (sesji w niej nie ma)
      if (!t.legacy) return null;
      const meta = await requestMeta();
      const iat = Number.isInteger(t.payload.iat) ? t.payload.iat : nowSec();
      await sql()`INSERT INTO sessions (id, user_id, created_at, expires_at, device, native, country)
                  VALUES (${t.sid}, ${uid}, to_timestamp(${iat}), to_timestamp(${t.payload.exp}),
                          ${meta.device}, ${meta.native}, ${meta.country})
                  ON CONFLICT (id) DO NOTHING`;
    }
    const { session_version, sid, revoked_at, stale, ...user } = u;
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
