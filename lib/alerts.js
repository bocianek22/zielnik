import { sql } from './db';
import { hit } from './ratelimit';
import { mailEnabled, sendMail } from './mail';

// PLA-2: alerty o błędach serwera z dziennika error_log do admina: webhook (ALERT_WEBHOOK_URL, Discord/Slack)
// i/lub e-mail (ALERT_EMAIL, przez tę samą wysyłkę co KON-1). Bez obu zmiennych wyłączone.
// Alert nie zawiera treści błędu (komunikaty SQL potrafią powtarzać dane z żądania), tylko źródło, ścieżkę
// bez identyfikatorów i nazw kont (alertPath), liczbę i czas.
// Pomijane źródła: błędy z przeglądarki (publiczny /api/client-error, każdy może je zgłosić) i błędy samych alertów.
export const ALERT_IGNORED = ['przeglądarka', 'alert'];
const WINDOW_MIN = 15;
// krótkie limity: alert idzie po odpowiedzi (after), ale i tak nie powinien blokować instancji dłużej niż trzeba
export const WEBHOOK_TIMEOUT_MS = 3000;
export const MAIL_TIMEOUT_MS = 4000;

const webhookUrl = () => {
  try {
    const u = new URL(process.env.ALERT_WEBHOOK_URL || '');
    return u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
};
const alertEmail = () => (mailEnabled() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.ALERT_EMAIL || '') ? process.env.ALERT_EMAIL : null);
export const alertThreshold = () => Math.max(1, Math.min(1000, parseInt(process.env.ALERT_THRESHOLD, 10) || 5));
export const alertChannels = () => ({ webhook: !!webhookUrl(), email: !!alertEmail() });
export const alertsEnabled = () => !!(webhookUrl() || alertEmail());

// Discord przyjmuje `content`, Slack `text`; inne usługi dostają `text`.
export function webhookBody(url, text) {
  const host = url.hostname.toLowerCase();
  return /(^|\.)discord(app)?\.com$/.test(host) ? { content: text } : { text };
}

// Wysyłka na wszystkie skonfigurowane kanały. Zwraca { webhook, email }: true/false/null (null = kanał wyłączony).
export async function sendAlert(subject, lines) {
  const text = [subject, ...lines].join('\n');
  const out = { webhook: null, email: null };
  const url = webhookUrl();
  if (url) {
    try {
      const r = await fetch(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(webhookBody(url, text)), signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS), redirect: 'error',
      });
      out.webhook = r.ok;
      if (!r.ok) await note(`Alert webhook: HTTP ${r.status}`);
    } catch (e) {
      out.webhook = false;
      await note(`Alert webhook: ${e?.name || 'błąd'}`);
    }
  }
  const to = alertEmail();
  if (to) {
    try {
      await sendMail({ to, subject, text, html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>` }, { timeoutMs: MAIL_TIMEOUT_MS });
      out.email = true;
    } catch (e) {
      out.email = false;
      await note(String(e?.message || 'Alert e-mail: błąd').slice(0, 200));
    }
  }
  return out;
}

// Błędy samych alertów: wprost do dziennika ze źródłem „alert” (pomijanym przez alerty, więc bez pętli)
async function note(message) {
  try { await sql()`INSERT INTO error_log (source, message) VALUES ('alert', ${message})`; } catch { /* bez bazy */ }
}

// Znane statyczne segmenty tras (katalogi w app/; tests/db/alerts.test.js pilnuje, by lista była kompletna). Każdy inny
// segment (id, sid, nazwa konta, a w przyszłości slug w nowej trasie dynamicznej) jest maskowany, więc nie wycieka do webhooka.
export const ROUTE_SEGMENTS = new Set([
  'account', 'admin', 'alerts', 'api', 'audit', 'auth', 'avatar', 'backup', 'backups', 'blocks', 'catalog', 'change-password', 'client-error', 'compare', 'config', 'cron', 'csv', 'custom', 'doctor-notes', 'dziennik', 'effects', 'email', 'enrich', 'entry', 'errors', 'export', 'fill', 'forgot', 'friends', 'groups', 'grupy', 'health', 'historia', 'history', 'import', 'invites', 'katalog', 'login', 'logout', 'native', 'none', 'notifications', 'nowe-haslo', 'obserwacje', 'odzyskaj-haslo', 'onboarding', 'options', 'pharmacy-photo', 'photo', 'photos', 'plan', 'potwierdz-email', 'prefs', 'premium', 'prescriptions', 'profil', 'profile', 'proposals', 'prywatnosc', 'purchase', 'purchases', 'push', 'rankings', 'raport', 'readiness', 'recepty', 'register', 'reminders', 'reports', 'reset', 'search', 'sessions', 'stats', 'strains', 'subscription', 'suggest', 'symptoms', 'szukaj', 'test', 'tests', 'u', 'usage', 'users', 'verify', 'version', 'wheel', 'wiedza', 'znajomi',
]);

// Ścieżka do alertu i do rozpoznania rodzaju błędu: tylko znane segmenty tras zostają, reszta jako „:id”,
// a nazwa konta z /u/... jako „:handle” (sama nazwa zdradzałaby usłudze webhooka, kto ma konto).
export function alertPath(path) {
  if (!path) return null;
  const segs = String(path).split(/[?#]/)[0].split('/');
  return segs.map((seg, i) => {
    if (!seg) return seg;
    if (segs[i - 1] === 'u') return ':handle';
    return ROUTE_SEGMENTS.has(seg) ? seg : ':id';
  }).join('/').slice(0, 200);
}

// Powiadomienie o udanym logowaniu admina (webhook i/lub e-mail). Treść: tylko zdarzenie, czas i skrót urządzenia
// (describeDevice), bez IP, nazwy konta i User-Agent; wysyła się w tle. Najwyżej 20 na godzinę (lawina logowań nie zalewa kanału).
// Bez skonfigurowanych kanałów nic nie robi. Nigdy nie rzuca.
export async function notifyAdminLogin(device) {
  try {
    if (!alertsEnabled() || !(await hit('alert:admin-login', 20, 3600))) return;
    await sendAlert('[Zielnik] Logowanie admina', [`Urządzenie: ${String(device || 'nieznane').slice(0, 80)}`, `Czas: ${new Date().toISOString()}`]);
  } catch (e) {
    console.error(e);
  }
}

const link = () => {
  try { return process.env.APP_URL ? `Dziennik błędów: ${new URL('/admin', process.env.APP_URL).href}` : null; } catch { return null; }
};

// Wołane z logError po zapisie błędu. Dwa powody alertu:
// 1) próg: co najmniej ALERT_THRESHOLD (domyślnie 5) błędów serwera w 15 min; najwyżej jeden taki alert na 15 min;
// 2) nowy rodzaj: pierwszy w dzienniku błąd o tym źródle, ścieżce i komunikacie (cyfry pomijane); najwyżej 3 na godzinę.
// Ponadto najwyżej 20 alertów na dobę. Nigdy nie rzuca.
export async function checkAlerts({ source, message, path }) {
  try {
    if (!alertsEnabled() || ALERT_IGNORED.includes(source)) return;
    const threshold = alertThreshold();
    const kind = alertPath(path);
    // ścieżki normalizowane w JS (dziennik ma najwyżej ~500 wierszy)
    const [recent, same] = await Promise.all([
      sql()`SELECT source, path FROM error_log WHERE at > now() - make_interval(mins => ${WINDOW_MIN}::int)
            AND source <> ALL(${ALERT_IGNORED})`,
      sql()`SELECT path FROM error_log WHERE source = ${source}
            AND regexp_replace(message, '[0-9]+', '#', 'g') = regexp_replace(${message}, '[0-9]+', '#', 'g')`,
    ]);
    let subject, lines;
    if (recent.length >= threshold && (await hit('alert:burst', 1, WINDOW_MIN * 60))) {
      const groups = new Map();
      for (const r of recent) {
        const k = `${r.source} ${alertPath(r.path) || '-'}`;
        groups.set(k, (groups.get(k) || 0) + 1);
      }
      const top = [...groups].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5);
      subject = `[Zielnik] ${recent.length} błędów serwera w ${WINDOW_MIN} min`;
      lines = [`Próg: ${threshold}. Najczęstsze (źródło, ścieżka, liczba):`, ...top.map(([k, n]) => `- ${k}: ${n}`)];
    } else if (same.filter((r) => alertPath(r.path) === kind).length <= 1 && (await hit('alert:new', 3, 3600))) {
      subject = '[Zielnik] Nowy rodzaj błędu serwera';
      lines = [`Źródło: ${source}, ścieżka: ${kind || '-'}.`];
    } else return;
    if (!(await hit('alert:day', 20, 86400))) return;
    lines.push(`Czas: ${new Date().toISOString()}`);
    const l = link();
    if (l) lines.push(l);
    await sendAlert(subject, lines);
  } catch (e) {
    console.error(e);
  }
}
