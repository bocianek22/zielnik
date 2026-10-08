import { ensureDb, sql } from './db';
import { fcmEnabled, sendFcm } from './fcm';

// PAC-3: przypomnienia push (recepta kończy ważność, kończy się zapas).
// Rodzaje subskrypcji: 'webpush' (PWA, klucze VAPID) i 'fcm' (aplikacja natywna, lib/fcm.js); 'apns' dojdzie z iOS.
export const SUPPORTED_KINDS = new Set(['webpush', 'fcm']);
export const MAX_DEVICES = 10;
// tyle kolejnych nieudanych wysyłek (bez 404/410) i subskrypcja jest usuwana (ok. miesiąc przy wysyłce raz dziennie)
export const MAX_FAILS = 30;
export const DEFAULT_PREFS = { notifyPrescription: true, notifyStock: true, stockDays: 5, notifyHour: 9, showDetails: false,
  notifySymptoms: false, symptomsHour: 21, notifyVisit: false, nextVisit: null };
// godziny wieczornego przypomnienia o objawach (czas polski)
export const SYMPTOMS_HOURS = [19, 20, 21, 22];
// wielkość porcji użytkowników w jednym zapytaniu oraz budżet czasu przebiegu crona (maxDuration trasy to 60 s)
export const MAX_USERS_PER_RUN = 500;
export const RUN_BUDGET_MS = 40000;

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
  for (const [k, col] of [['notifySymptoms', 'sym'], ['notifyVisit', 'visit']]) {
    if (b?.[k] === undefined) out[col] = null;
    else if (typeof b[k] === 'boolean') out[col] = b[k];
    else return { error: 'Nieprawidłowe ustawienia przypomnień.' };
  }
  if (b?.symptomsHour === undefined) out.symHour = null;
  else if (SYMPTOMS_HOURS.includes(Number(b.symptomsHour)) && Number.isInteger(Number(b.symptomsHour))) out.symHour = Number(b.symptomsHour);
  else return { error: `Godzina przypomnienia o objawach musi być z zakresu ${SYMPTOMS_HOURS[0]}-${SYMPTOMS_HOURS.at(-1)}.` };
  // data wizyty: pominięta = bez zmian, pusta (null/'') = usuń
  out.visitSet = b?.nextVisit !== undefined;
  out.visitDate = null;
  if (out.visitSet && b.nextVisit !== null && b.nextVisit !== '') {
    const d = String(b.nextVisit);
    const t = Date.parse(`${d}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d || d < '2000-01-01' || d > '2100-12-31') return { error: 'Nieprawidłowa data wizyty.' };
    out.visitDate = d;
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
      COALESCE(p.notify_symptoms, FALSE) AS "notifySymptoms", COALESCE(p.symptoms_hour, 21) AS "symptomsHour",
      COALESCE(p.notify_visit, FALSE) AS "notifyVisit", to_char(p.next_visit_on, 'YYYY-MM-DD') AS "nextVisit",
      (SELECT count(*)::int FROM push_subscriptions s WHERE s.user_id = ${userId}::int) AS devices
    FROM (SELECT 1) one LEFT JOIN push_prefs p ON p.user_id = ${userId}::int`;
  return p;
}

export async function savePrefs(userId, p) {
  await ensureDb();
  await sql()`INSERT INTO push_prefs (user_id, notify_prescription, notify_stock, stock_days, notify_hour, show_details,
                            notify_symptoms, symptoms_hour, notify_visit, next_visit_on)
    VALUES (${userId}::int, COALESCE(${p.rx}::boolean, TRUE), COALESCE(${p.stock}::boolean, TRUE), COALESCE(${p.days}::int, 5),
            COALESCE(${p.hour}::int, 9), COALESCE(${p.details}::boolean, FALSE),
            COALESCE(${p.sym ?? null}::boolean, FALSE), COALESCE(${p.symHour ?? null}::int, 21), COALESCE(${p.visit ?? null}::boolean, FALSE),
            CASE WHEN ${p.visitSet ?? false}::boolean THEN ${p.visitDate ?? null}::date END)
    ON CONFLICT (user_id) DO UPDATE SET
      notify_prescription = COALESCE(${p.rx}::boolean, push_prefs.notify_prescription),
      notify_stock = COALESCE(${p.stock}::boolean, push_prefs.notify_stock),
      stock_days = COALESCE(${p.days}::int, push_prefs.stock_days),
      notify_hour = COALESCE(${p.hour}::int, push_prefs.notify_hour),
      show_details = COALESCE(${p.details}::boolean, push_prefs.show_details),
      notify_symptoms = COALESCE(${p.sym ?? null}::boolean, push_prefs.notify_symptoms),
      symptoms_hour = COALESCE(${p.symHour ?? null}::int, push_prefs.symptoms_hour),
      notify_visit = COALESCE(${p.visit ?? null}::boolean, push_prefs.notify_visit),
      next_visit_on = CASE WHEN ${p.visitSet ?? false}::boolean THEN ${p.visitDate ?? null}::date ELSE push_prefs.next_visit_on END,
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
// Zapas: suma stanów jak w StrainsBoard, średnie zużycie jak dailyUse (ostatnie 30 dni), osobno dla g i ml.
// Wizyta (POM-15): dzień wcześniej ('visit:1') i w dniu ('visit:0'), o godzinie ogólnej notify_hour.
// Objawy (POM-05): 'symptoms' od symptoms_hour (okno 3 godzin), tylko gdy dziś brak wpisu (wbudowanego ani własnego) i tylko
// w trybie godzinowym (respectHour) - przy cronie raz dziennie rano wieczorne przypomnienie nie ma sensu.
// after: kursor (tylko użytkownicy o id większym), do porcjowania w sendReminders.
// respectHour: tylko użytkownicy, których godzina (czas polski) już minęła; hour nadpisuje bieżącą godzinę (testy).
export async function dueReminders({ userId = null, respectHour = false, hour = null, limit = MAX_USERS_PER_RUN, after = 0 } = {}) {
  await ensureDb();
  return sql()`
    WITH today AS (
      SELECT (now() AT TIME ZONE 'Europe/Warsaw')::date AS d,
             COALESCE(${hour}::int, EXTRACT(HOUR FROM now() AT TIME ZONE 'Europe/Warsaw')::int) AS h
    ), who AS (
      SELECT u.id AS user_id, COALESCE(p.notify_prescription, TRUE) AS rx, COALESCE(p.notify_stock, TRUE) AS stock,
             COALESCE(p.stock_days, 5) AS stock_days, COALESCE(p.show_details, FALSE) AS show_details,
             COALESCE(p.notify_symptoms, FALSE) AS sym, COALESCE(p.symptoms_hour, 21) AS sym_hour,
             COALESCE(p.notify_visit, FALSE) AS visit, p.next_visit_on,
             (NOT ${respectHour}::boolean OR COALESCE(p.notify_hour, 9) <= today.h) AS hour_ok
      FROM users u CROSS JOIN today LEFT JOIN push_prefs p ON p.user_id = u.id
      WHERE EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id)
        AND (${userId}::int IS NULL OR u.id = ${userId}::int)
        AND u.id > ${after}::int
    ), rx AS (
      SELECT w.user_id, 'rx:' || p.id AS key, p.unit, to_char(p.valid_until, 'YYYY-MM-DD') AS valid_until,
             (p.valid_until - t.d)::int AS days_left,
             GREATEST(p.grams - COALESCE((SELECT SUM(pu.grams) FROM purchases pu WHERE pu.user_id = p.user_id AND strain_unit(pu.strain_id) = p.unit
               AND (pu.created_at AT TIME ZONE 'Europe/Warsaw')::date BETWEEN p.issued_on AND p.valid_until), 0), 0)::float8 AS remaining
      FROM who w JOIN prescriptions p ON p.user_id = w.user_id CROSS JOIN today t
      WHERE w.rx AND w.hour_ok AND p.valid_until BETWEEN t.d AND t.d + 7
    ), per_day AS (
      SELECT l.user_id, form_unit(s.form) AS unit, SUM(l.grams)::float8
               / GREATEST(1, LEAST(30, CEIL(EXTRACT(EPOCH FROM (now() - MIN(l.created_at))) / 86400)))::float8 AS v
      FROM usage_log l JOIN strains s ON s.id = l.strain_id JOIN who w ON w.user_id = l.user_id AND w.stock AND w.hour_ok
      WHERE l.created_at > now() - interval '30 days' GROUP BY l.user_id, form_unit(s.form)
    ), stock AS (
      SELECT us.user_id, form_unit(s.form) AS unit, SUM(us.current_amount)::float8 AS total
      FROM user_strain us JOIN strains s ON s.id = us.strain_id
      WHERE us.current_amount > 0 AND us.user_id IN (SELECT user_id FROM per_day) GROUP BY us.user_id, form_unit(s.form)
    ), items AS (
      SELECT user_id, key, 'rx' AS type,
             jsonb_build_object('validUntil', valid_until, 'daysLeft', days_left, 'remaining', remaining, 'unit', unit) AS data
      FROM rx WHERE remaining > 0
      UNION ALL
      -- gramy i ml osobno (nie sumujemy suszu z olejem); klucz 'stock' dla gramów jak przed jednostkami
      SELECT s.user_id, CASE WHEN s.unit = 'g' THEN 'stock' ELSE 'stock:' || s.unit END, 'stock',
             jsonb_build_object('daysLeft', floor(s.total / d.v)::int, 'total', s.total, 'perDay', d.v, 'unit', s.unit)
      FROM stock s JOIN per_day d ON d.user_id = s.user_id AND d.unit = s.unit JOIN who w ON w.user_id = s.user_id
      WHERE d.v > 0 AND floor(s.total / d.v) <= w.stock_days
      UNION ALL
      SELECT w.user_id, 'visit:' || (w.next_visit_on - t.d)::text, 'visit', jsonb_build_object('daysLeft', (w.next_visit_on - t.d)::int)
      FROM who w CROSS JOIN today t WHERE w.visit AND w.hour_ok AND w.next_visit_on - t.d IN (0, 1)
      UNION ALL
      SELECT w.user_id, 'symptoms', 'symptoms', '{}'::jsonb
      FROM who w CROSS JOIN today t
      WHERE w.sym AND ${respectHour}::boolean AND t.h BETWEEN w.sym_hour AND w.sym_hour + 2
        AND NOT EXISTS (SELECT 1 FROM symptom_log sl WHERE sl.user_id = w.user_id AND sl.day = t.d
                        AND (sl.pain IS NOT NULL OR sl.sleep IS NOT NULL OR sl.anxiety IS NOT NULL OR sl.mood IS NOT NULL OR sl.note <> ''))
        AND NOT EXISTS (SELECT 1 FROM symptom_values sv WHERE sv.user_id = w.user_id AND sv.day = t.d)
    )
    SELECT i.user_id, w.show_details,
           jsonb_agg(jsonb_build_object('key', i.key, 'type', i.type) || i.data ORDER BY i.type, i.key) AS items
    FROM items i JOIN who w ON w.user_id = i.user_id CROSS JOIN today t
    WHERE NOT EXISTS (SELECT 1 FROM push_sent ps WHERE ps.user_id = i.user_id AND ps.key = i.key AND ps.sent_on = t.d)
    GROUP BY i.user_id, w.show_details ORDER BY i.user_id LIMIT ${limit}::int`;
}

const num = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const days = (n) => (n === 1 ? '1 dzień' : `${n} dni`);
const unit = (i) => (i.unit === 'ml' ? 'ml' : 'g');
export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10, dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
}

// Jedno zgrupowane powiadomienie. Domyślnie bez szczegółów: treść może być widoczna na ekranie blokady,
// a recepty i zapasy to dane zdrowotne. Nazw odmian nie ma nigdy, także w wersji szczegółowej.
export function buildPayload(items, showDetails = false) {
  const n = items.length;
  const only = (t) => items.every((i) => i.type === t);
  const url = only('rx') ? '/recepty' : only('symptoms') ? '/#objawy' : only('visit') ? '/profil' : '/';
  const base = { title: 'Zielnik', url, tag: 'zielnik-przypomnienia' };
  if (only('symptoms')) return { ...base, body: 'Masz wpis do uzupełnienia.' }; // neutralnie także bez szczegółów
  if (!showDetails) return { ...base, body: `Masz ${n} ${plural(n, 'przypomnienie', 'przypomnienia', 'przypomnień')}. Otwórz aplikację, aby zobaczyć szczegóły.` };
  const lines = items.map((i) => {
    if (i.type === 'symptoms') return 'Masz wpis do uzupełnienia.';
    if (i.type === 'visit') return i.daysLeft <= 0 ? 'Dziś masz wizytę.' : 'Jutro masz wizytę.';
    if (i.type === 'rx') {
      const [, m, d] = String(i.validUntil).split('-');
      const when = i.daysLeft <= 0 ? 'wygasa dziś' : `ważna jeszcze ${days(i.daysLeft)} (do ${d}.${m})`;
      return `Recepta ${when}: zostało ${num(i.remaining)} ${unit(i)} do wykupienia.`;
    }
    const what = unit(i) === 'ml' ? 'Zapas oleju/pena' : 'Zapas';
    return i.daysLeft <= 0
      ? `${what} wystarczy na mniej niż dzień (${num(i.total)} ${unit(i)}).`
      : `${what} wystarczy na ok. ${days(i.daysLeft)} (${num(i.total)} ${unit(i)}).`;
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
// fcmPayload: osobna (zawsze neutralna) treść dla FCM - Google widzi ją jawnie, więc nie niesie szczegółów.
export async function deliver(userId, payload, send = senderOverride || (pushConfig().enabled ? webPushSend : null), fcmPayload = payload) {
  await ensureDb();
  const q = sql();
  const out = { ok: 0, failed: 0, removed: 0 };
  const subs = await q`SELECT id, kind, endpoint, keys FROM push_subscriptions WHERE user_id = ${userId}::int ORDER BY id`;
  const json = JSON.stringify(payload);
  const senders = { webpush: send ? (s) => send(s, json) : null, fcm: fcmEnabled() ? (s) => sendFcm(s.endpoint.replace(/^fcm:/, ''), fcmPayload) : null };
  // pominięte (rodzaj bez konfiguracji na serwerze): licznik pojawia się w wyniku tylko, gdy > 0
  const skip = () => { out.skipped = (out.skipped || 0) + 1; };
  for (const s of subs) if (!SUPPORTED_KINDS.has(s.kind) || !senders[s.kind]) skip();
  await Promise.all(subs.filter((s) => SUPPORTED_KINDS.has(s.kind) && senders[s.kind]).map(async (s) => {
    try {
      await senders[s.kind](s);
      out.ok++;
      await q`UPDATE push_subscriptions SET last_ok_at = now(), fails = 0 WHERE id = ${s.id}`;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) {
        out.removed++;
        await q`DELETE FROM push_subscriptions WHERE id = ${s.id}`;
      } else if (e?.skipped) {
        skip(); // chwilowo pomijany (np. nieudane OAuth zapamiętane na minutę): bez błędu
      } else if (e?.transient) {
        out.failed++; // błąd konfiguracji lub usługi, nie tokenu: nie przybliża usunięcia subskrypcji
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
export async function sendReminders({ send, respectHour = pushConfig().hourly, hour = null, userId = null, limit = MAX_USERS_PER_RUN, budgetMs = RUN_BUDGET_MS } = {}) {
  const q = sql();
  const stats = { users: 0, notifications: 0, delivered: 0, failed: 0, removed: 0 };
  const deadline = Date.now() + budgetMs;
  // Porcje z kursorem user_id: nieudane dostawy zwalniają push_sent, więc bez kursora te same najniższe id wracałyby
  // w każdej porcji i głodziły wyższe. Po wyczerpaniu budżetu reszta czeka na następny przebieg.
  let cursor = 0;
  for (;;) {
    const due = await dueReminders({ userId, respectHour, hour, limit, after: cursor });
    for (const u of due) {
      cursor = u.user_id;
      if (Date.now() > deadline) { stats.partial = true; break; }
      const keys = u.items.map((i) => i.key);
      const claimed = new Set((await q`INSERT INTO push_sent (user_id, key, sent_on)
          SELECT ${u.user_id}::int, k, (now() AT TIME ZONE 'Europe/Warsaw')::date FROM unnest(${keys}::text[]) k
          ON CONFLICT DO NOTHING RETURNING key`).map((r) => r.key));
      const items = u.items.filter((i) => claimed.has(i.key));
      if (!items.length) continue;
      stats.users++;
      let r;
      try { r = await deliver(u.user_id, buildPayload(items, u.show_details), send, buildPayload(items, false)); }
      catch (e) { console.error(e); r = { ok: 0, failed: 1, removed: 0 }; } // błąd jednego użytkownika nie przerywa pętli
      stats.delivered += r.ok; stats.failed += r.failed; stats.removed += r.removed;
      if (r.ok > 0) stats.notifications++;
      else await q`DELETE FROM push_sent WHERE user_id = ${u.user_id}::int AND key = ANY(${[...claimed]}::text[])
                     AND sent_on = (now() AT TIME ZONE 'Europe/Warsaw')::date`;
    }
    if (stats.partial || due.length < limit) break;
  }
  // stare znaczniki nie są potrzebne (służą tylko do blokady powtórki tego samego dnia)
  await q`DELETE FROM push_sent WHERE sent_on < (now() AT TIME ZONE 'Europe/Warsaw')::date - 30`;
  return stats;
}
