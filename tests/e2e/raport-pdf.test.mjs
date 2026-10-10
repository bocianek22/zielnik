// Raport dla lekarza jako PDF (POM-40): „Pobierz PDF” tworzy plik lokalnie (A4, neutralna nazwa, także w trybie dyskretnym),
// biblioteka i czcionka ładują się dopiero po kliknięciu, przyciski mają cele >= 44 px, axe bez naruszeń. Uruchomienie: npm run test:e2e.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

const { PDFDocument } = createRequire(import.meta.url)('pdf-lib');
let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

async function download(page) {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: 'Pobierz PDF' }).click()]);
  const path = await dl.path();
  return { name: dl.suggestedFilename(), bytes: readFileSync(path) };
}

test('Raport: „Pobierz PDF” daje poprawny plik A4 z polskimi znakami, biblioteka ładuje się dopiero po kliknięciu', async () => {
  const { ctx, problems } = await phone(browser);
  const page = await ctx.newPage();
  const loaded = [];
  page.on('request', (r) => loaded.push(r.url()));
  try {
    await login(page);
    await go(page, '/raport?from=2020-01-01&to=2026-12-31');
    const btn = page.getByRole('button', { name: 'Pobierz PDF' });
    await btn.waitFor({ timeout: 15000 });
    assert.ok((await btn.boundingBox()).height >= 44, 'przycisk niższy niż 44 px');
    assert.ok((await page.getByRole('button', { name: 'Drukuj' }).boundingBox()).height >= 44);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'poziome przewijanie');
    assert.equal(loaded.filter((u) => /Figtree-(Regular|Bold)\.ttf/.test(u)).length, 0, 'czcionka PDF ładowana przed kliknięciem');
    const before = loaded.length;

    const { name, bytes } = await download(page);
    assert.match(name, /^raport-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.doesNotMatch(name, /konop/i);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 5000, `rozmiar ${bytes.length}`);
    if (process.env.E2E_PDF_OUT) writeFileSync(process.env.E2E_PDF_OUT, bytes); // podgląd ręczny: E2E_PDF_OUT=/ścieżka/raport.pdf
    assert.ok(loaded.slice(before).some((u) => /Figtree-Regular\.ttf/.test(u)), 'czcionka z własnej domeny po kliknięciu');
    assert.ok(loaded.every((u) => !/^https?:/.test(u) || new URL(u).origin === new URL(page.url()).origin), 'żądanie poza własną domenę');

    const doc = await PDFDocument.load(bytes);
    assert.ok(doc.getPageCount() >= 1);
    assert.ok(Math.abs(doc.getPage(0).getWidth() - 595.28) < 0.1, 'A4');

    // pdftotext (jeśli jest): polskie znaki w treści
    const dir = mkdtempSync(join(tmpdir(), 'raport-pdf-'));
    const file = join(dir, 'r.pdf');
    writeFileSync(file, bytes);
    const t = spawnSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
    if (t.status === 0) {
      assert.match(t.stdout, /Zestawienie stosowania medycznej konopi/);
      assert.match(t.stdout, /Podsumowanie/);
      assert.match(t.stdout, /Strona 1 z \d+/);
      assert.match(t.stdout, /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/);
    }
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'raport-pdf'); throw e; } finally { await ctx.close(); }
});

test('Raport: w trybie dyskretnym plik też ma neutralną nazwę, a plik się tworzy', async () => {
  const { ctx } = await phone(browser, { discreet: true });
  const page = await ctx.newPage();
  try {
    await login(page);
    await go(page, '/raport');
    const { name, bytes } = await download(page);
    assert.match(name, /^raport-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  } catch (e) { await shot(page, 'raport-pdf-dyskretny'); throw e; } finally { await ctx.close(); }
});

test('Raport: axe (WCAG AA) w jasnym i ciemnym motywie z przyciskami PDF', async () => {
  for (const colorScheme of ['light', 'dark']) {
    const { ctx } = await phone(browser);
    await ctx.addInitScript((t) => { try { localStorage.setItem('zielnik.theme', t); } catch {} }, colorScheme);
    const page = await ctx.newPage();
    try {
      await login(page);
      await go(page, '/raport');
      await page.getByRole('button', { name: 'Pobierz PDF' }).waitFor({ timeout: 15000 });
      const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      const found = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
      assert.deepEqual(found, [], `naruszenia axe (${colorScheme})`);
    } catch (e) { await shot(page, `raport-pdf-axe-${colorScheme}`); throw e; } finally { await ctx.close(); }
  }
});

// APK (Capacitor): atrapa powłoki z wtyczkami ZielnikShare i ZielnikPrint. „Udostępnij PDF” przekazuje PDF jako base64 do wtyczki.
const nativeShell = (withShare) => {
  const calls = (window.__native = { share: [], print: [] });
  Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) ZielnikApp/0.5.0' });
  window.Capacitor = { isNativePlatform: () => true, Plugins: {
    ZielnikPrint: { print: async (a) => { calls.print.push(a); } },
    ...(withShare ? { ZielnikShare: { sharePdf: async (a) => { calls.share.push(a); } } } : {}),
  } };
};

test('Raport w APK: „Udostępnij PDF” wysyła poprawny PDF (base64) do wtyczki, obok „Drukuj”', async () => {
  const { ctx } = await phone(browser);
  await ctx.addInitScript(nativeShell, true);
  const page = await ctx.newPage();
  try {
    await login(page);
    await go(page, '/raport');
    const share = page.getByRole('button', { name: 'Udostępnij PDF' });
    await share.waitFor({ timeout: 15000 });
    assert.ok((await share.boundingBox()).height >= 44);
    assert.equal(await page.getByRole('button', { name: 'Pobierz PDF' }).count(), 0, 'pobieranie nie działa w WebView');
    await share.click();
    await page.waitForFunction(() => window.__native.share.length === 1, null, { timeout: 20000 });
    const arg = await page.evaluate(() => window.__native.share[0]);
    assert.match(arg.fileName, /^raport-\d{4}-\d{2}-\d{2}\.pdf$/);
    assert.equal(Buffer.from(arg.base64, 'base64').subarray(0, 5).toString(), '%PDF-');
    await page.getByRole('button', { name: 'Drukuj' }).click();
    await page.waitForFunction(() => window.__native.print.length === 1);
  } catch (e) { await shot(page, 'raport-apk-share'); throw e; } finally { await ctx.close(); }
});

test('Raport w starszym APK (bez ZielnikShare): zostaje tylko druk', async () => {
  const { ctx } = await phone(browser);
  await ctx.addInitScript(nativeShell, false);
  const page = await ctx.newPage();
  try {
    await login(page);
    await go(page, '/raport');
    await page.getByRole('button', { name: 'Udostępnij / Zapisz PDF' }).waitFor({ timeout: 15000 });
    assert.equal(await page.getByRole('button', { name: 'Udostępnij PDF' }).count(), 0);
  } catch (e) { await shot(page, 'raport-apk-stare'); throw e; } finally { await ctx.close(); }
});
