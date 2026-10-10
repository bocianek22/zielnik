// Wspólne narzędzia testów E2E (Playwright, Chromium, 390 px). Serwer i dane startują z scripts/dev/e2e.sh;
// adres z E2E_BASE (domyślnie http://localhost:4610). Konta z scripts/dev/seed.mjs: <login>-haslo-1.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

export const BASE = process.env.E2E_BASE || 'http://localhost:4610';
export const SHOTS = process.env.E2E_SHOTS || 'zrzuty/e2e';

// playwright: z projektu (CI), z globalnych modułów Node albo z NODE_PATH (sesja chmurowa)
function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const base of [undefined, '/opt/node22/lib/node_modules/', process.env.NODE_PATH]) {
    try { return (base ? createRequire(base)('playwright') : require('playwright')).chromium; } catch { /* następny */ }
  }
  throw new Error('Brak modułu playwright (npm ci albo NODE_PATH).');
}

// Chromium: PLAYWRIGHT_BROWSERS_PATH albo /opt/pw-browsers; w CI domyślna instalacja (npx playwright install chromium)
function chromiumPath() {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  if (!existsSync(root)) return undefined;
  const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  return exe && existsSync(exe) ? exe : undefined;
}

export async function launch() {
  const executablePath = chromiumPath();
  return loadPlaywright().launch(executablePath ? { executablePath } : {});
}

// Kontekst telefonu. Każda strona dostaje nasłuch: błąd konsoli, naruszenie CSP, wyjątek strony albo odpowiedź >= 400
// kończą test (`problems`). `ignore`: wzorce adresów, których błędy są znane.
export async function phone(browser, { storageState, discreet = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pl-PL', storageState,
  });
  if (discreet) await ctx.addCookies([{ name: 'zielnik_discreet', value: '1', url: BASE }]);
  const problems = [];
  problems.allow = (...re) => { problems.ok.push(...re); }; // oczekiwane odpowiedzi (np. 401 przy złym haśle)
  problems.ok = [];
  problems.left = () => problems.filter((x) => !problems.ok.some((r) => r.test(x)));
  ctx.on('page', (p) => {
    p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) problems.push(`konsola: ${m.text().slice(0, 300)}`); });
    p.on('pageerror', (e) => problems.push(`błąd strony: ${String(e).slice(0, 300)}`));
    p.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
  });
  return { ctx, problems };
}

// Lokalnie wszystkie logowania mają jeden adres („unknown”), a limit to 30 na 15 min: pełny przebieg go przekracza.
// Przed logowaniem testowym zerujemy liczniki logowania w bazie testowej (sam limit sprawdzają tests/db).
let limitsPool;
async function resetLoginLimits() {
  if (!process.env.E2E_DB_URL) return;
  limitsPool ||= new pg.Pool({ connectionString: process.env.E2E_DB_URL, max: 1, allowExitOnIdle: true });
  await limitsPool.query("DELETE FROM rate_limits WHERE key LIKE 'login-%'");
}

export async function login(page, user = 'ania') {
  await resetLoginLimits();
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  await page.fill('#u', user);
  await page.fill('#p', user === 'Bocian' ? 'bocian-haslo-1' : `${user}-haslo-1`);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), page.click('button[type=submit]')]);
}

export async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name.replace(/[^\w-]+/g, '-')}.png`), fullPage: true }).catch(() => {});
}

// Czekanie na hydratację Reacta: klik przed nią nic nie robi i jest źródłem niestabilnych testów
export async function hydrated(page) {
  await page.waitForFunction(() => {
    const nodes = [document.body, ...document.querySelectorAll('main *, header *')].slice(0, 60);
    return nodes.some((n) => Object.keys(n).some((k) => k.startsWith('__reactFiber') || k.startsWith('__reactProps')));
  }, null, { timeout: 15000 });
}

// React podpina obsługę zdarzeń do poddrzew w różnym czasie; przed klawiaturą czekamy na konkretny element
export async function interactive(locator) {
  await locator.page().waitForFunction((el) => Object.keys(el).some((k) => k.startsWith('__reactProps')),
    await locator.elementHandle(), { timeout: 15000 });
}

export async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
  await hydrated(page);
}

// Ścieżka do Chromium dla narzędzi spoza Playwrighta (Lighthouse): CHROME_PATH, lokalny /opt/pw-browsers albo przeglądarka Playwrighta
export function chromeExecutable() {
  return process.env.CHROME_PATH || chromiumPath() || loadPlaywright().executablePath();
}
