// Budżety wydajności (POM-24): Lighthouse w trybie mobilnym dla /login (bez logowania) i / (konto ania z seed.mjs).
// Użycie: node scripts/dev/lighthouse.mjs --port 4400 [--runs 3] [--budgets tests/perf/budgets.json] [--update]
// Mediana z kilku przebiegów porównywana z progami z budgets.json; kod wyjścia 1 po przekroczeniu. --update wypisuje
// pomiary jako propozycję progów (pomiar x zapas) bez porównywania. Wyniki JSON trafiają do zrzuty/lighthouse/.
// Metryki: LCP, CLS, TBT (w trybie nawigacji INP nie jest mierzony; TBT jest jego laboratoryjnym odpowiednikiem), rozmiar JS
// (przesłane bajty skryptów) i liczba żądań. lighthouse + chrome-launcher z devDependencies (poza repo: LIGHTHOUSE_DIR=katalog z node_modules).
import { pathToFileURL } from 'node:url';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromeExecutable } from '../../tests/e2e/helpers.mjs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const PORT = opt('port', '4400');
const RUNS = Number(opt('runs', '3'));
const BUDGETS = opt('budgets', 'tests/perf/budgets.json');
const OUT = opt('out', 'zrzuty/lighthouse');
const UPDATE = argv.includes('--update');
const B = `http://localhost:${PORT}`;

const MAIN = { lighthouse: 'core/index.js', 'chrome-launcher': 'dist/index.js' };
async function load(name) {
  try { return await import(name); } catch (e) {
    if (!process.env.LIGHTHOUSE_DIR) throw new Error(`Brak modułu ${name} (npm ci albo LIGHTHOUSE_DIR): ${e.message}`);
    return import(pathToFileURL(join(process.env.LIGHTHOUSE_DIR, 'node_modules', name, MAIN[name])).href);
  }
}
const lighthouse = (await load('lighthouse')).default;
const chromeLauncher = await load('chrome-launcher');

// ciasteczko sesji konta ania: logowanie przez API (jak w seed.mjs)
async function sessionCookie() {
  const r = await fetch(`${B}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', origin: B }, body: JSON.stringify({ username: 'ania', password: 'ania-haslo-1' }) });
  if (r.status >= 400) throw new Error(`logowanie ania: ${r.status}`);
  return r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
}

const PAGES = [{ path: '/login', cookie: false }, { path: '/', cookie: true }];
const cookie = await sessionCookie();
const chrome = await chromeLauncher.launch({ chromePath: chromeExecutable(), chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
mkdirSync(OUT, { recursive: true });

const measured = {};
try {
  for (const pg of PAGES) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) {
      const flags = { port: chrome.port, output: 'json', onlyCategories: ['performance'], logLevel: 'error', ...(pg.cookie && { extraHeaders: { Cookie: cookie } }) };
      const { lhr } = await lighthouse(B + pg.path, flags);
      if (lhr.runtimeError) throw new Error(`${pg.path}: ${lhr.runtimeError.message}`);
      if (new URL(lhr.finalDisplayedUrl).pathname !== pg.path) throw new Error(`${pg.path}: przekierowanie na ${lhr.finalDisplayedUrl} (sesja nie działa?)`);
      const a = lhr.audits;
      const res = a['resource-summary'].details.items;
      runs.push({
        lcp: a['largest-contentful-paint'].numericValue, cls: a['cumulative-layout-shift'].numericValue, tbt: a['total-blocking-time'].numericValue,
        jsKb: (res.find((x) => x.resourceType === 'script')?.transferSize ?? 0) / 1024, requests: res.find((x) => x.resourceType === 'total')?.requestCount ?? 0,
        score: lhr.categories.performance.score * 100,
      });
      if (i === 0) writeFileSync(join(OUT, `${pg.path === '/' ? 'start' : pg.path.slice(1)}.json`), JSON.stringify(lhr));
    }
    measured[pg.path] = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]));
  }
} finally { await chrome.kill(); }

const fmt = { lcp: (v) => `${Math.round(v)} ms`, cls: (v) => v.toFixed(3), tbt: (v) => `${Math.round(v)} ms`, jsKb: (v) => `${Math.round(v)} KB`, requests: (v) => `${v}`, score: (v) => `${Math.round(v)}` };
console.log(`Lighthouse (mobilnie, mediana z ${RUNS}):`);
for (const [path, m] of Object.entries(measured)) console.log(`  ${path}  ${Object.entries(m).map(([k, v]) => `${k} ${fmt[k](v)}`).join(' · ')}`);

if (UPDATE) {
  // propozycja progów: pomiar x zapas (CLS, TBT: stały dodatek, bo bliskie zeru pomiary nie nadają się na mnożnik)
  const prop = Object.fromEntries(Object.entries(measured).map(([p, m]) => [p, {
    lcp: Math.ceil((m.lcp * 1.4) / 100) * 100, cls: Math.round((m.cls + 0.05) * 100) / 100, tbt: Math.ceil((m.tbt * 1.5 + 100) / 50) * 50,
    jsKb: Math.ceil((m.jsKb * 1.15) / 10) * 10, requests: Math.ceil(m.requests * 1.3),
  }]));
  console.log('Propozycja progów:\n' + JSON.stringify(prop, null, 2));
  process.exit(0);
}

const budgets = JSON.parse(readFileSync(BUDGETS, 'utf8'));
let bad = 0;
for (const [path, m] of Object.entries(measured)) {
  for (const [k, max] of Object.entries(budgets[path] || {})) {
    if (k === 'note') continue;
    if (m[k] > max) { bad++; console.log(`PRZEKROCZONO ${path} ${k}: ${fmt[k](m[k])} > ${fmt[k](max)}`); }
  }
}
if (bad) { console.log(`budżety: ${bad} przekroczeń`); process.exit(1); }
console.log('budżety: w normie');
