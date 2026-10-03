import { ensureDb, sql } from './db';
import { fcmEnabled, sendFcm } from './fcm';

// PAC-3: przypomnienia push (recepta kończy ważność, kończy się zapas).
// Rodzaje subskrypcji: 'webpush' (PWA, klucze VAPID) i 'fcm' (aplikacja natywna, lib/fcm.js); 'apns' dojdzie z iOS.
export const SUPPORTED_KINDS = new Set(['webpush', 'fcm']);
export const MAX_DEVICES = 10;
// tyle kolejnych nieudanych wysyłek (bez 404/410) i subskrypcja jest usuwana (ok. miesiąc przy wysyłce raz dziennie)
export const MAX_FAILS = 30;
export const DEFAULT_PREFS = { notifyPrescription: true, notifyStock: true, stockDays: 5, notifyHour: 9, showDetails: false };

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY || '';
  const enabled = Boolean(publicKey && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  // Vercel Hobby: cron maks. raz dziennie, więc godzina z ustawień działa dopiero przy częstszym wywoływaniu crona
  // enabled: Web Push (PWA); fcm: aplikacja natywna; any: cokolwiek można wysłać (cron, powiadomienie testowe)
  const fcm = fcmEnabled();
  return { enabled, fcm, any: enabled || fcm, publicKey: enabled ? publicKey : null, hourly: process.env.PUSH_CRON_HOURLY === '1' };
}

export const NOT_CONFIGURED = 'Powiadomienia push nie są jeszcze skonfigurowane na serwerze (brak kluczy VAPID i konta Firebase).';

// Serwer wysyła żądanie pod adres podany przez przeglądarkę, więc dopuszczamy tylko znane usługi push
// (inaczej dowolny użytkownik mógłby kazać serwerowi łączyć się z dowolnym adresem).
const PUSH_HOSTS = ['fcm.googleapis.com', 'android.googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com'];
const B64URL = /^[A-Za-z0-9_-]+={0,2}$/;

// { endpoint, keys } albo { error }
export function parseSubscription(body) {
  const s = body?.subscription ?? body;
  const endpoint = typeof s?.endpoint === 'string' ? s.endpoint.trim() : '';
  let u;
  try { u = new URL(endpoint); } catch { return { error: 'Nieprawidłowa subskrypcja powiadomień.' }; }
  if (u.protocol !== 'https:' || endpoint.length > 1000) return { error: 'Adres subskrypcji musi używać https.' };
  const host = u.hostname.toLowerCase();
  if (!PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return { error: 'Nieobsługiwana usługa powiadomień.' };
  const { p256dh, auth } = s.keys || {};
  for (const k of [p256dh, auth]) {
    if (typeof k !== 'string' || k.length < 8 || k.length > 200 || !B64URL.test(k)) return { error: 'Nieprawidłowe klucze subskrypcji.' };
  }
  return { endpoint, keys: { p256dh, auth } };
}

// Aplikacja natywna (mobile/, Capacitor + FCM): token rejestracji FCM. Zapisywany jako endpoint 'fcm:<token>'
// (osobna przestrzeń od adresów Web Push w kolumnie UNIQUE). Wysyła je deliver() przez lib/fcm.js.
const FCM_TOKEN = /^[A-Za-z0-9_:-]{20,4096}$/;
export const fcmEndpoint = (token) => (typeof token === 'string' && FCM_TOKEN.test(token.trim()) ? `fcm:${token.trim()}` : null);

// { endpoint, keys } albo { error }
export function parseFcmToken(body) {
  const endpoint = fcmEndpoint(body?.token);
  return endpoint ? { endpoint, keys: {} } : { error: 'Nieprawidłowy token powiadomień aplikacji.' };
}

// Częściowe preferencje (pominięte pola bez zmian) albo { error }
export function parsePrefs(b) {
  const out = {};
  for (const [k, col] of [['notifyPrescription', 'rx'], ['notifyStock', 'stock'], ['showDetails', 'details']]) {
    if (b?.[k] === undefined) out[col] = null;
    else if (typeof b[k] === 'boolean') out[col] = b[k];
    else return { error: 'Nieprawidłowe ustawienia powiadomień.' };
  }
  for (const [k, col, min, max] of [['stockDays', 'days', 1, 30], ['notifyHour', 'hour', 0, 23]]) {
    if (b?.[k] === undefined) { out[col] = null; continue; }
    const n = Number(b[k]);
    if (!Number.isInteger(n) || n < min || n > max) return { error: k === 'notifyHour' ? 'Godzina musi być z zakresu 0-23.' : 'Liczba dni zapasu musi być z zakresu 1-30.' };
    out[col] = n;
  }
  return { prefs: out };
}

export async function getPrefs(userId) {
  await ensureDb();
  const [p] = await sql()`SELECT COALESCE(p.notify_prescription, TRUE) AS "notifyPrescription", COALESCE(p.notify_stock, TRUE) AS "notifyStock",
      COALESCE(p.stock_days, 5) AS "stockDays", COALESCE(p.notify_hour, 9) AS "notifyHour", COALESCE(p.show_details, FALSE) AS "showDetails",
      (SELECT count(*)::int FROM push_subscriptions s WHERE s.user_id = ${userId}::int) AS devices
    FROM (SELECT 1) one LEFT JOIN push_prefs p ON p.user_id = ${userId}::int`;
  return p;
}

export async function savePrefs(userId, p) {
  await ensureDb();
  await sql()`INSERT INTO push_prefs (user_id, notify_prescription, notify_stock, stock_days, notify_hour, show_details)
    VALUES (${userId}::int, COALESCE(${p.rx}::boolean, TRUE), COALESCE(${p.stock}::boolean, TRUE), COALESCE(${p.days}::int, 5),
            COALESCE(${p.hour}::int, 9), COALESCE(${p.details}::boolean, FALSE))
    ON CONFLICT (user_id) DO UPDATE SET
      notify_prescription = COALESCE(${p.rx}::boolean, push_prefs.notify_prescription),
      notify_stock = COALESCE(${p.stock}::boolean, push_prefs.notify_stock),
      stock_days = COALESCE(${p.days}::int, push_prefs.stock_days),
      notify_hour = COALESCE(${p.hour}::int, push_prefs.notify_hour),
      show_details = COALESCE(${p.details}::boolean, push_prefs.show_details),
      updated_at = now()`;
  return getPrefs(userId);
}

// Zapis subskrypcji. Adres przypisany już do innego konta (wspólne urządzenie) przechodzi na to konto tylko przy
// świadomym włączeniu (claim); samo odświeżenie przy otwarciu aplikacji go nie przejmuje. Zwraca true, gdy subskrypcja jest użytkownika.
export async function saveSubscription(userId, kind, endpoint, keys, claim = false) {
  await ensureDb();
  const q = sql();
  const r = await q`INSERT INTO push_subscriptions (user_id, kind, endpoint, keys) VALUES (${userId}::int, ${kind}, ${endpoint}, ${JSON.stringify(keys)}::jsonb)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, kind = EXCLUDED.kind, keys = EXCLUDED.keys, fails = 0,
      created_at = CASE WHEN push_subscriptions.user_id = EXCLUDED.user_id THEN push_subscriptions.created_at ELSE now() END
    WHERE push_subscriptions.user_id = EXCLUDED.user_id OR ${claim}::boolean
    RETURNING id`;
  if (!r.length) return false;
  await q`INSERT INTO push_prefs (user_id) VALUES (${userId}::int) ON CONFLICT DO NOTHING`;
  await q`DELETE FROM push_subscriptions WHERE user_id = ${userId}::int AND id NOT IN (
    SELECT id FROM push_subscriptions WHERE user_id = ${userId}::int ORDER BY created_at DESC, id DESC LIMIT ${MAX_DEVICES}::int)`;
  return true;
}

export async function deleteSubscription(userId, endpoint) {
  await ensureDb();
  const r = await sql()`DELETE FROM push_subscriptions WHERE user_id = ${userId}::int AND endpoint = ${endpoint} RETURNING id`;
  return r.length > 0;
}

// Przypomnienia do wysłania, zgrupowane po użytkowniku: [{ user_id, show_details, items: [{ key, type, ... }] }].
// Recepta: ta sama logika co prescriptionAlerts (lib/strains.js), ale tylko recepty jeszcze ważne (0-7 dni);
// wygasłe pokazuje strona główna, w powiadomieniu wracałyby codziennie bez końca.
// Zapas: suma stanów jak w StrainsBoard, średnie zużycie jak dailyUse (ostatnie 30 dni).
// respectHour: tylko użytkownicy, których godzina (czas polski) już minęła; hour nadpisuje bieżącą godzinę (testy).
export async function dueReminders({ userId = null, respectHour = false, hour = null } = {}) {
  await ensureDb();
  return sql()`
    WITH today AS (
      SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d,
             COALESCE(${hour}::int, EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Warsaw')::int) AS h
    ), who AS (
      SELECT u.id AS user_id, COALESCE(p.notify_prescription, TRUE) AS rx, COALESCE(p.notify_stock, TRUE) AS stock,
             COALESCE(p.stock_days, 5) AS stock_days, COALESCE(p.show_details, FALSE) AS show_details
      FROM users u CROSS JOIN today LEFT JOIN push_prefs p ON p.user_id = u.id
      WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id)
        AND (${userId}::int IS NULL OR u.id = ${userId}::int)
        AND (NOT ${respectHour}::boolean OR COALESCE(p.notify_hour, 9) <= today.h)
    ), rx AS (
      SELECT w.user_id, 'rx:' || p.id AS key, to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
             (p.valid_until - t.d)::int AS days_left,
             GREATEST(p.grams - COALESCE((SELECT SUM(pu.grams) FROM purchases pu WHERE pu.user_id = p.user_id
               AND (pu.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN p.issued_on AND p.valid_until), 0), 0)::float8 AS remaining
      FROM who w JOIN prescriptions p ON p.user_id = w.user_id CROSS JOIN today t
      WHERE w.rx AND p.valid_until BETWEEN t.d AND t.d + 7
    ), per_day AS (
      SELECT l.user_id, SUM(l.grams)::float8
               / GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (now() - MIN(l.created_at))) / 86400)))::float8 AS v
      FROM usage_log l JOIN who w ON w.user_id = l.user_id AND w.stock
      WHERE l.created_at > now() - interval '30 days' GROUP BY l.user_id
    ), stock AS (
      SELECT us.user_id, SUM(us.current_amount)::float8 AS total
      FROM user_strain us JOIN per_day d ON d.user_id = us.user_id
      WHERE us.current_amount > 0 GROUP BY us.user_id
    ), items AS (
      SELECT user_id, key, 'rx' AS type,
             jsonb_build_object('validUntil', valid_until, 'daysLeft', days_left, 'remaining', remaining) AS data
      FROM rx WHERE remaining > 0
      UNION ALL
      SELECT s.user_id, 'stock', 'stock',
             jsonb_build_object('daysLeft', floor(s.total / d.v)::int, 'total', s.total, 'perDay', d.v)
      FROM stock s JOIN per_day d ON d.user_id = s.user_id JOIN who w ON w.user_id = s.user_id
      WHERE d.v > 0 AND floor(s.total / d.v) <= w.stock_days
    )
    SELECT i.user_id, w.show_details,
           jsonb_agg(jsonb_build_object('key', i.key, 'type', i.type) || i.data ORDER BY i.type, i.key) AS items
    FROM items i JOIN who w ON w.user_id = i.user_id CROSS JOIN today t
    WHERE NOT EXISTS (SELECT 1 FROM push_sent ps WHERE ps.user_id = i.user_id AND ps.key = i.key AND ps.sent_on = t.d)
    GROUP BY i.user_id, w.show_details ORDER BY i.user_id`;
}

const num = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const days = (n) => (n === 1 ? '1 dzień' : `${n} dni`);
export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
}

// Jedno zgrupowane powiadomienie. Domyślnie bez szczegółów: treść może być widoczna na ekranie blokady,
// a recepty i zapasy to dane zdrowotne. Nazw odmian nie ma nigdy, także w wersji szczegółowej.
export function buildPayload(items, showDetails = false) {
  const n = items.length;
  const url = items.every((i) => i.type === 'rx') ? '/recepty' : '/';
  const base = { title: 'Zielnik', url, tag: 'zielnik-przypomnienia' };
  if (!showDetails) return { ...base, body: `Masz ${n} ${plural(n, 'przypomnienie', 'przypomnienia', 'przypomnień')}. Otwórz aplikację, aby zobaczyć szczegóły.` };
  const lines = items.map((i) => {
    if (i.type === 'rx') {
      const [, m, d] = String(i.validUntil).split('-');
      const when = i.daysLeft <= 0 ? 'wygasa dziś' : `ważna jeszcze ${days(i.daysLeft)} (do ${d}.${m})`;
      return `Recepta ${when}: zostało ${num(i.remaining)} g do wykupienia.`;
    }
    return i.daysLeft <= 0
      ? `Zapas wystarczy na mniej niż dzień (${num(i.total)} g).`
      : `Zapas wystarczy na ok. ${days(i.daysLeft)} (${num(i.total)} g).`;
  });
  return { ...base, body: lines.join('\n') };
}

export const TEST_PAYLOAD = { title: 'Zielnik', body: 'Testowe powiadomienie działa.', url: '/profil', tag: 'zielnik-test' };

let senderOverride = null;
// Tylko dla testów: podmiana wysyłki (fn(sub, payloadJson)), null przywraca domyślną.
export function setPushSender(fn) { senderOverride = fn; }

async function webPushSend(sub, payload) {
  const { default: webpush } = await import('web-push');
  return webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, {
    vapidDetails: { subject: process.env.VAPID_SUBJECT, publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY },
    TTL: 12 * 3600,
    timeout: 10000, // zawieszona usługa push nie może zablokować całego crona
    urgency: 'normal',
  });
}

// Wysyła payload na wszystkie urządzenia użytkownika (Web Push i FCM). 404/410 = subskrypcja wygasła (usuwamy), inne błędy liczymy.
// Rodzaj, którego serwer nie ma skonfigurowanego (brak VAPID albo konta Firebase), jest pomijany bez liczenia błędów.
export async function deliver(userId, payload, send = senderOverride || (pushConfig().enabled ? webPushSend : null)) {
  await ensureDb();
  const q = sql();
  const out = { ok: 0, failed: 0, removed: 0 };
  const subs = await q`SELECT id, kind, endpoint, keys FROM push_subscriptions WHERE user_id = ${userId}::int ORDER BY id`;
  const json = JSON.stringify(payload);
  const senders = { webpush: send ? (s) => send(s, json) : null, fcm: fcmEnabled() ? (s) => sendFcm(s.endpoint.replace(/^fcm:/, ''), payload) : null };
  await Promise.all(subs.filter((s) => SUPPORTED_KINDS.has(s.kind) && senders[s.kind]).map(async (s) => {
    try {
      await senders[s.kind](s);
      out.ok++;
      await q`UPDATE push_subscriptions SET last_ok_at = now(), fails = 0 WHERE id = ${s.id}`;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        out.removed++;
        await q`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
      } else {
        out.failed++;
        const [r] = await q`UPDATE push_subscriptions SET fails = fails + 1 WHERE id = ${s.id} RETURNING fails`;
        if (r && r.fails >= MAX_FAILS) await q`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
      }
    }
  }));
  return out;
}

// Cron: jedno powiadomienie na użytkownika. Przypomnienia są najpierw "rezerwowane" w push_sent (INSERT ... ON CONFLICT),
// więc dwa równoległe wywołania nie wyślą tego samego; gdy nie dotarło na żadne urządzenie, rezerwacja jest zwalniana.
export async function sendReminders({ send, respectHour = pushConfig().hourly, hour = null, userId = null } = {}) {
  const q = sql();
  const due = await dueReminders({ userId, respectHour, hour });
  const stats = { users: 0, notifications: 0, delivered: 0, failed: 0, removed: 0 };
  for (const u of due) {
    const keys = u.items.map((i) => i.key);
    const claimed = new Set((await q`INSERT INTO push_sent (user_id, key, sent_on)
        SELECT ${u.user_id}::int, k, (now() AT TIME ZONE 'Europe/Warsaw')::date FROM unnest(${keys}::text[]) k
        ON CONFLICT DO NOTHING RETURNING key`).map((r) => r.key));
    const items = u.items.filter((i) => claimed.has(i.key));
    if (!items.length) continue;
    stats.users++;
    let r;
    try { r = await deliver(u.user_id, buildPayload(items, u.show_details), send); }
    catch (e) { console.error(e); r = { ok: 0, failed: 1, removed: 0 }; } // błąd jednego użytkownika nie przerywa pętli
    stats.delivered += r.ok; stats.failed += r.failed; stats.removed += r.removed;
    if (r.ok > 0) stats.notifications++;
    else await q`DELETE FROM push_sent WHERE user_id = ${u.user_id}::int AND key = ANY(${[...claimed]}::text[])
                   AND sent_on = (now() AT TIME ZONE 'Europe/Warsaw')::date`;
  }
  // stare znaczniki nie są potrzebne (służą tylko do blokady powtórki tego samego dnia)
  await q`DELETE FROM push_sent WHERE sent_on < (now() AT TIME ZONE 'Europe/Warsaw')::date - 30`;
  return stats;
}
