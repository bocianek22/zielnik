// Zrzuty ekranu przez Playwright. Użycie:
//   node scripts/dev/shots.mjs --port 4400 --out /tmp/zrzuty --pages /,/raport --widths 390 --themes light,dark [--discreet] [--login ania]
// Domyślnie: --login ania, --widths 390, --themes light, --pages /. Hasło konta = <login>-haslo-1 (patrz seed.mjs), Bocian ma bocian-haslo-1.
// Czeka na `load` + krótką pauzę (nie networkidle: service worker i odpytywanie nigdy się nie uspokajają).
// Wypisuje błędy konsoli i CSP oraz odpowiedzi >= 400. Kod wyjścia 1, gdy wystąpiły.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = opt('port', '4400');
const OUT = opt('out', 'zrzuty');
const PAGES = opt('pages', '/').split(',');
const WIDTHS = opt('widths', '390').split(',').map(Number);
const THEMES = opt('themes', 'light').split(',');
const LOGIN = opt('login', 'ania');
const DISCREET = argv.includes('--discreet');
const PAUSE = Number(opt('pause', '600'));
const B = `http://localhost:${PORT}`;

// playwright: z projektu, z globalnych modułów Node albo z NODE_PATH
const require = createRequire(import.meta.url);
let chromium;
for (const base of [undefined, '/opt/node22/lib/node_modules/', process.env.NODE_PATH]) {
  try { ({ chromium } = base ? createRequire(base)('playwright') : require('playwright')); break; } catch { /* następny */ }
}
if (!chromium) { console.error('Brak modułu playwright (npm i -g playwright albo NODE_PATH).'); process.exit(1); }

// chromium: PLAYWRIGHT_BROWSERS_PATH albo /opt/pw-browsers
const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
let executablePath;
if (existsSync(root)) {
  const dir = readdirSync(root).filter((d) => /^chromium-\d+$/.test(d)).sort().pop();
  const exe = dir && join(root, dir, 'chrome-linux', 'chrome');
  if (exe && existsSync(exe)) executablePath = exe;
}

const slug = (p) => (p === '/' ? 'start' : p.replace(/^\//, '').replace(/[^\w-]+/g, '-'));
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let problems = 0;
const log = (...a) => { problems++; console.log(...a); };

for (const width of WIDTHS) {
  for (const theme of THEMES) {
    const mobile = width < 500;
    const ctx = await browser.newContext({ viewport: { width, height: mobile ? 844 : 860 }, colorScheme: theme, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
    if (DISCREET) await ctx.addCookies([{ name: 'zielnik_discreet', value: '1', url: B }]);
    const watch = (p, where) => {
      p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) log(`[${where}] konsola:`, m.text().slice(0, 300)); });
      p.on('pageerror', (e) => log(`[${where}] błąd strony:`, String(e).slice(0, 300)));
      p.on('response', (r) => { if (r.status() >= 400) log(`[${where}] ${r.status()} ${r.url().replace(B, '')}`); });
    };
    if (LOGIN && LOGIN !== 'none') {
      const p = await ctx.newPage();
      await p.goto(`${B}/login`, { waitUntil: 'load' });
      await p.fill('#u', LOGIN);
      await p.fill('#p', LOGIN === 'Bocian' ? 'bocian-haslo-1' : `${LOGIN}-haslo-1`);
      await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), p.click('button[type=submit], button.btn')]);
      await p.close();
    }
    for (const path of PAGES) {
      const name = `${slug(path)}-${width}-${theme}${DISCREET ? '-dyskretny' : ''}`;
      const p = await ctx.newPage();
      watch(p, name);
      try {
        await p.goto(B + path, { waitUntil: 'load' });
        await p.waitForTimeout(PAUSE);
        await p.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
        console.log('ok', join(OUT, `${name}.png`));
      } catch (e) { log('BŁĄD', name, e.message.split('\n')[0]); }
      await p.close();
    }
    await ctx.close();
  }
}
await browser.close();
if (problems) { console.log(`uwagi: ${problems}`); process.exit(1); }
