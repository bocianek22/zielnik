import { sql } from './db';
import { hit } from './ratelimit';
import { background, mailEnabled, sendMail } from './mail';

// PLA-2: alerty o błędach serwera z dziennika error_log do admina: webhook (ALERT_WEBHOOK_URL, Discord/Slack)
// i/lub e-mail (ALERT_EMAIL, przez tę samą wysyłkę co KON-1). Bez obu zmiennych wyłączone.
// Alert nie zawiera treści błędu (komunikaty SQL potrafią powtarzać dane z żądania), tylko źródło, ścieżkę
// (bez zapytania, jak w error_log), liczbę i czas.
// Pomijane źródła: błędy z przeglądarki (publiczny /api/client-error, każdy może je zgłosić) i błędy samych alertów.
export const ALERT_IGNORED = ['przeglądarka', 'alert'];
const WINDOW_MIN = 15;

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
        body: JSON.stringify(webhookBody(url, text)), signal: AbortSignal.timeout(5000), redirect: 'error',
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
      await sendMail({ to, subject, text, html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</pre>` });
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
    const [r] = await sql()`SELECT
        (SELECT count(*)::int FROM error_log WHERE at > now() - make_interval(mins => ${WINDOW_MIN}::int)
           AND source <> ALL(${ALERT_IGNORED})) AS recent,
        (SELECT count(*)::int FROM error_log WHERE source = ${source} AND path IS NOT DISTINCT FROM ${path}
           AND regexp_replace(message, '[0-9]+', '#', 'g') = regexp_replace(${message}, '[0-9]+', '#', 'g')) AS same`;
    let subject, lines;
    if (r.recent >= threshold && (await hit('alert:burst', 1, WINDOW_MIN * 60))) {
      const groups = await sql()`SELECT source, path, count(*)::int AS n FROM error_log
                                 WHERE at > now() - make_interval(mins => ${WINDOW_MIN}::int) AND source <> ALL(${ALERT_IGNORED})
                                 GROUP BY source, path ORDER BY n DESC, source LIMIT 5`;
      subject = `[Zielnik] ${r.recent} błędów serwera w ${WINDOW_MIN} min`;
      lines = [`Próg: ${threshold}. Najczęstsze (źródło, ścieżka, liczba):`, ...groups.map((g) => `- ${g.source} ${g.path || '-'}: ${g.n}`)];
    } else if (r.same <= 1 && (await hit('alert:new', 3, 3600))) {
      subject = '[Zielnik] Nowy rodzaj błędu serwera';
      lines = [`Źródło: ${source}, ścieżka: ${path || '-'}.`];
    } else return;
    if (!(await hit('alert:day', 20, 86400))) return;
    lines.push(`Czas: ${new Date().toISOString()}`);
    const l = link();
    if (l) lines.push(l);
    const p = background(() => sendAlert(subject, lines));
    if (p) await p;
  } catch (e) {
    console.error(e);
  }
}
