import { after } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { DISCREET_COOKIE, DISCREET_TITLE } from './discreet';

// Wysyłka e-maili przez HTTP API Resend (bez SDK). Włączona tylko z RESEND_API_KEY i MAIL_FROM; bez nich funkcje
// e-mail są ukryte, a trasy odpowiadają 503 z czytelnym komunikatem.
const RESEND_URL = 'https://api.resend.com/emails';
export const MAIL_DISABLED_MSG = 'Wysyłka e-maili nie jest skonfigurowana w tej instalacji.';

export const mailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);

const isLoopback = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';

// MAIL_API_URL tylko do testów E2E (atrapa na localhost); każdy inny adres jest ignorowany, więc pomyłka
// w zmiennych nie wyśle maili (i klucza API) pod obcy serwer.
function apiUrl() {
  try {
    const u = new URL(process.env.MAIL_API_URL || '');
    if (u.protocol === 'http:' && isLoopback(u.hostname)) return u.href;
  } catch { /* brak lub błędny adres */ }
  return RESEND_URL;
}

// Testy podmieniają wysyłkę na atrapę: fn({ to, subject, text, html })
let transport = null;
export function setMailTransport(fn) { transport = fn; }

export async function sendMail({ to, subject, text, html }) {
  if (transport) return transport({ to, subject, text, html });
  if (!mailEnabled()) throw new Error(MAIL_DISABLED_MSG);
  const r = await fetch(apiUrl(), {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
    signal: AbortSignal.timeout(8000),
  });
  // Tylko kod statusu: treść odpowiedzi dostawcy może powtarzać adres odbiorcy, a dziennik błędów widzi admin.
  if (!r.ok) throw new Error(`Wysyłka e-mail: HTTP ${r.status}`);
}

// Praca po wysłaniu odpowiedzi (after() z Next.js): czas odpowiedzi nie zależy od wysyłki, więc nie zdradza,
// czy konto istnieje. Poza zakresem żądania (testy, część ścieżek błędów) zadanie rusza od razu;
// testy czekają na nie przez flushBackground().
const pending = new Set();
export function background(fn) {
  const run = () => Promise.resolve().then(fn).catch((e) => console.error(e));
  try {
    after(run);
    return;
  } catch { /* poza zakresem żądania */ }
  const p = run();
  pending.add(p);
  p.finally(() => pending.delete(p));
}
export async function flushBackground() {
  while (pending.size) await Promise.all([...pending]);
}

// Adres do linków w mailach. APP_URL ma pierwszeństwo; bez niego nagłówek Host tylko z listy dozwolonych
// (domeny Vercel z zmiennych systemowych i APP_HOSTS), żeby podrobiony Host nie wstawił do maila linku
// z tokenem do obcej domeny (Host header injection). null = nie wysyłamy.
export function allowedHosts() {
  return [process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL,
    ...String(process.env.APP_HOSTS || '').split(',')]
    .map((h) => String(h || '').trim().toLowerCase()).filter(Boolean);
}

export async function appUrl() {
  if (process.env.APP_URL) {
    try {
      const u = new URL(process.env.APP_URL);
      if (u.protocol === 'https:' || (u.protocol === 'http:' && isLoopback(u.hostname))) return u.origin;
    } catch { /* błędny APP_URL */ }
    return null;
  }
  let host = '';
  try { host = String((await headers()).get('host') || '').trim().toLowerCase(); } catch { return null; }
  if (!host || !allowedHosts().includes(host)) return null;
  return `${isLoopback(host.replace(/:\d+$/, '')) ? 'http' : 'https'}://${host}`;
}

// Nazwa aplikacji w treści maili: „Notatnik”, gdy urządzenie, z którego wyszło żądanie, ma tryb dyskretny.
export async function appName() {
  try { if ((await cookies()).get(DISCREET_COOKIE)?.value === '1') return DISCREET_TITLE; } catch { /* poza żądaniem */ }
  return 'Zielnik';
}

// Klucze limitów bez adresów e-mail w jawnej postaci
export const digest = (s) => createHash('sha256').update(String(s)).digest('base64url').slice(0, 32);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Prosta, neutralna wiadomość: bez słów o konopiach i lekach, link jako jedyny element aktywny.
export function message({ subject, lines, link, linkLabel, footer }) {
  const text = [...lines, '', link, '', footer].join('\n');
  const html = `<!doctype html><html lang="pl"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222">${
    lines.map((l) => `<p>${esc(l)}</p>`).join('')
  }<p><a href="${esc(link)}" style="display:inline-block;padding:10px 16px;background:#2f6b3a;color:#fff;border-radius:6px;text-decoration:none">${esc(linkLabel)}</a></p><p style="font-size:13px;color:#555">${esc(link)}</p><p style="font-size:13px;color:#555">${esc(footer)}</p></body></html>`;
  return { subject, text, html };
}
