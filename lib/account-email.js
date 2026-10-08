import { createHash, randomBytes } from 'node:crypto';
import { ensureDb, sql } from './db';
import { hit } from './ratelimit';
import { logError } from './errorlog';
import { DISCREET_TITLE } from './discreet';
import { appName, appUrl, background, digest, message, sendMail } from './mail';

// KON-1: adres e-mail konta, weryfikacja i odzyskiwanie hasła.
// Token: 32 losowe bajty (base64url) w linku, w bazie tylko SHA-256; ważny 30 min, jednorazowy, działa tylko najnowszy.
// Link niesie token we fragmencie (#t=...), więc nie trafia do logów serwera ani do nagłówka Referer.
export const TOKEN_TTL_MIN = 30;
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export const RESET_PAGE = '/nowe-haslo';
export const VERIFY_PAGE = '/potwierdz-email';
export const RESET_SENT_MSG = 'Jeśli konto ma potwierdzony adres e-mail, wysłaliśmy na niego link do ustawienia nowego hasła. Link jest ważny 30 minut.';

const hashToken = (t) => createHash('sha256').update(String(t)).digest('base64url');

// Adres: bez spacji i znaków sterujących, jedna „@”, domena z kropką. Zapisywany małymi literami.
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"_]+\.[^\s@<>()[\]\\,;:"_]{2,}$/;
export function normalizeEmail(v) {
  const e = String(v ?? '').trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) && ![...e].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127) ? e : null;
}

export async function issueToken(userId, purpose, email) {
  await ensureDb();
  const token = randomBytes(32).toString('base64url');
  // Jedno zapytanie (CTE): usunięcie poprzednich i wstawienie nowego są atomowe, więc nie powstanie stan "brak tokenu"
  // ani dwa żywe tokeny. Dwa równoległe wywołania nadal mogą zostawić oba (każde nie widzi wstawki drugiego), dlatego
  // zużycie (consumeToken) i tak sprawdza jednorazowość, a unieważnia je kolejna prośba lub zmiana hasła/adresu.
  await sql()`WITH d AS (
                DELETE FROM email_tokens WHERE (user_id = ${userId} AND purpose = ${purpose}) OR expires_at < now() - interval '1 day')
              INSERT INTO email_tokens (user_id, purpose, token_hash, email, expires_at)
              VALUES (${userId}, ${purpose}, ${hashToken(token)}, ${email}, now() + make_interval(mins => ${TOKEN_TTL_MIN}::int))`;
  return token;
}

// Jedno warunkowe UPDATE: dwa równoległe żądania z tym samym tokenem nie przejdą oba. null = zły, zużyty lub wygasły.
export async function consumeToken(token, purpose) {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  await ensureDb();
  const [r] = await sql()`UPDATE email_tokens SET used_at = now()
                          WHERE token_hash = ${hashToken(token)} AND purpose = ${purpose} AND used_at IS NULL AND expires_at > now()
                          RETURNING user_id, email`;
  return r || null;
}

// Wysyłka bez rzucania; błąd do dziennika bez adresu odbiorcy
async function deliver(to, mail) {
  try {
    await sendMail({ to, ...mail });
  } catch (e) {
    await logError('mail', e);
  }
}

// Link weryfikacyjny na adres konta. false = brak dozwolonego adresu aplikacji albo limit adresu (bez wysyłki).
export async function sendVerification(userId, email, username = null) {
  username ??= (await sql()`SELECT username FROM users WHERE id = ${userId}`)[0]?.username;
  const base = await appUrl();
  if (!base) {
    await logError('mail', new Error('Brak dozwolonego adresu aplikacji (ustaw APP_URL).'));
    return false;
  }
  // limit na adres docelowy (cicho: komunikat „za dużo maili na ten adres” zdradzałby, że ktoś inny go używa)
  if (!(await hit(`mail-verify-to:${digest(email)}`, 3, 3600))) return false;
  const name = await appName();
  const token = await issueToken(userId, 'verify', email);
  background(() => deliver(email, message({
    subject: `${name}: potwierdź adres e-mail`,
    lines: [`Ten adres został dodany do konta „${username}” w aplikacji ${name}.`, `Aby go potwierdzić, otwórz link poniżej. Link jest ważny ${TOKEN_TTL_MIN} minut.`],
    link: `${base}${VERIFY_PAGE}#t=${token}`,
    linkLabel: 'Potwierdź adres',
    footer: 'Jeśli to nie Ty, zignoruj tę wiadomość: bez potwierdzenia adres nie będzie używany.',
  })));
  return true;
}

// Prośba o reset hasła po nazwie użytkownika albo adresie. Zawsze kończy się tak samo (wywołujący zwraca jedną
// odpowiedź): brak konta, brak lub niepotwierdzony adres, konto admina albo limit konta lub adresu = brak wysyłki.
// Konta administratora są pominięte: przejęcie skrzynki nie może dać dostępu do panelu i kopii
// (admin odzyskuje dostęp przez BOCIAN_INITIAL_PASSWORD albo innego admina).
export async function requestReset(ident) {
  await ensureDb();
  const rows = ident.includes('@')
    ? await sql()`SELECT id, username, email FROM users
                  WHERE email = ${ident} AND email_verified_at IS NOT NULL AND NOT is_admin ORDER BY id LIMIT 5`
    : await sql()`SELECT id, username, email FROM users
                  WHERE lower(username) = ${ident} AND email IS NOT NULL AND email_verified_at IS NOT NULL AND NOT is_admin`;
  if (!rows.length) return;
  const base = await appUrl();
  if (!base) {
    await logError('mail', new Error('Brak dozwolonego adresu aplikacji (ustaw APP_URL).'));
    return;
  }
  // Reset jest anonimowy: nazwa z ciasteczka trybu dyskretnego osoby wpisującej login nie może zdradzać „Zielnika”
  // adresatowi maila (to nie musi być ta sama osoba), więc zawsze neutralna.
  const name = DISCREET_TITLE;
  // Limity, token i wysyłka po odpowiedzi: ścieżka „konto istnieje” nie robi przed odpowiedzią więcej zapytań
  // niż pozostałe (na Neon każde zapytanie to osobne żądanie HTTP).
  background(async () => {
    // limit na adres liczony raz na prośbę (kilka kont może mieć ten sam adres)
    if (!(await hit(`mail-reset-to:${digest(rows[0].email)}`, 3, 3600))) return;
    for (const u of rows) {
      if (!(await hit(`mail-reset-acct:${u.id}`, 3, 3600))) continue;
      const token = await issueToken(u.id, 'reset', u.email);
      await deliver(u.email, message({
        subject: `${name}: ustawienie nowego hasła`,
        lines: [`Otrzymaliśmy prośbę o ustawienie nowego hasła do konta „${u.username}” w aplikacji ${name}.`,
          `Aby ustawić nowe hasło, otwórz link poniżej. Link jest ważny ${TOKEN_TTL_MIN} minut i działa jeden raz.`],
        link: `${base}${RESET_PAGE}#t=${token}`,
        linkLabel: 'Ustaw nowe hasło',
        footer: 'Jeśli to nie Ty, zignoruj tę wiadomość: hasło pozostanie bez zmian.',
      }));
    }
  });
}

// Wyrównanie czasu odpowiedzi do stałej wartości (ścieżka „konto istnieje” robi kilka zapytań więcej).
let floorMs = 400;
export function setResponseFloor(ms) { floorMs = ms; }
export async function padResponse(start) {
  const left = floorMs - (Date.now() - start);
  if (left > 0) await new Promise((r) => setTimeout(r, left));
}
