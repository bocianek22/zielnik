// Szerokość komputera (1280 i 1024 px): brak poziomego przewijania, menu górne zamiast dolnego, tabele historii,
// raport dla lekarza w druku, eksport konta, panel admina, axe (jasny motyw). Uruchomienie: npm run test:e2e.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { BASE, launch, login, shot, go, interactive } from './helpers.mjs';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SIZES = [{ width: 1280, height: 800 }, { width: 1024, height: 768 }];

let browser;
const sessions = {};
before(async () => {
  browser = await launch();
  for (const user of ['ania', 'Bocian']) {
    const ctx = await browser.newContext({ viewport: SIZES[0], locale: 'pl-PL' });
    const page = await ctx.newPage();
    await login(page, user);
    sessions[user] = await ctx.storageState();
    await ctx.close();
  }
});
after(async () => { await browser?.close(); });

async function open(user, viewport) {
  const ctx = await browser.newContext({ viewport, locale: 'pl-PL', storageState: sessions[user] });
  await ctx.addInitScript(() => { try { localStorage.setItem('zielnik.theme', 'light'); } catch {} });
  const problems = [];
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) problems.push(`konsola: ${m.text().slice(0, 300)}`); });
  page.on('pageerror', (e) => problems.push(`błąd strony: ${String(e).slice(0, 300)}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url().replace(BASE, '')}`); });
  return { ctx, page, problems };
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const serious = async (page) => (await new AxeBuilder({ page }).withTags(TAGS).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

async function strainPath(page) {
  await go(page, '/');
  const link = page.locator('a[href^="/strains/"]').first();
  await link.waitFor({ timeout: 15000 });
  return link.getAttribute('href');
}

for (const size of SIZES) {
  test(`${size.width} px: strony bez poziomego przewijania, menu górne, axe`, async () => {
    const { ctx, page, problems } = await open('ania', size);
    const found = [];
    try {
      const strain = await strainPath(page);
      for (const path of ['/', '/katalog', strain, '/dziennik', '/historia', '/raport', '/profil', '/recepty', '/obserwacje']) {
        await go(page, path);
        await page.locator('main').first().waitFor();
        await page.waitForLoadState('networkidle').catch(() => {});
        const o = await overflow(page);
        if (o > 0) found.push(`${path}: poziome przewijanie o ${o} px`);
        if (await page.locator('.bottomnav').isVisible()) found.push(`${path}: widoczne dolne menu`);
        if (!(await page.locator('.topbar .nav').first().isVisible())) found.push(`${path}: brak menu górnego`);
        for (const v of await serious(page)) found.push(`${path}: ${v}`);
      }
      assert.deepEqual(found, []);
      assert.deepEqual(problems, []);
    } catch (e) { await shot(page, `komputer-${size.width}`); throw e; } finally { await ctx.close(); }
  });
}

test('1280 px: Historia ma tabele mieszczące się w oknie', async () => {
  const { ctx, page } = await open('ania', SIZES[0]);
  try {
    await go(page, '/historia');
    await page.locator('table').first().waitFor({ timeout: 15000 });
    assert.ok(await page.locator('table').first().isVisible(), 'tabela w Historii');
    assert.equal(await overflow(page), 0);
    const wide = await page.evaluate(() => [...document.querySelectorAll('table')].filter((t) => t.getBoundingClientRect().right > innerWidth + 1).length);
    assert.equal(wide, 0, 'tabela wychodzi poza okno');
  } catch (e) { await shot(page, 'komputer-historia'); throw e; } finally { await ctx.close(); }
});

for (const size of SIZES) {
  test(`${size.width} px: raport w druku bez nawigacji i bez poziomego przewijania`, async () => {
    const { ctx, page } = await open('ania', size);
    try {
      await go(page, '/raport');
      await page.locator('.report-sheet').waitFor({ timeout: 15000 });
      await page.emulateMedia({ media: 'print' });
      assert.equal(await overflow(page), 0, 'poziome przewijanie w druku');
      for (const sel of ['.topbar', '.bottomnav', '.fab', '.no-print']) {
        const n = await page.locator(sel).evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
        assert.equal(n, 0, `${sel} widoczne w druku`);
      }
      assert.ok(await page.locator('.report-sheet').isVisible(), 'arkusz raportu');
      const clipped = await page.evaluate(() => [...document.querySelectorAll('.report-sheet *')].filter((e) => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length);
      assert.equal(clipped, 0, 'elementy raportu poza szerokością strony');
      assert.ok((await page.pdf({ format: 'A4' })).length > 1000);
    } catch (e) { await shot(page, `komputer-druk-${size.width}`); throw e; } finally { await ctx.close(); }
  });
}

test('1280 px: eksport konta zwraca plik JSON', async () => {
  const { ctx, page } = await open('ania', SIZES[0]);
  try {
    await go(page, '/profil');
    const res = await ctx.request.get(`${BASE}/api/account/export`);
    assert.equal(res.status(), 200);
    assert.match(res.headers()['content-type'], /application\/json/);
    assert.match(res.headers()['content-disposition'], /^attachment;/);
    const data = await res.json();
    assert.ok(data.exportedAt && data.profile?.username === 'ania');
    // przycisk w profilu to zwykły link do tego adresu: sprawdzamy, że przeglądarka pobiera plik
    const link = page.getByRole('link', { name: 'Pobierz dane (JSON)', exact: true });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    assert.match(download.suggestedFilename(), /\.json$/);
  } finally { await ctx.close(); }
});

test('1280 px: panel admina, zakładki Gotowość i Zgłoszenia', async () => {
  const { ctx, page, problems } = await open('Bocian', SIZES[0]);
  const found = [];
  try {
    await go(page, '/admin');
    for (const [name, panel] of [['Zgłoszenia', '#apanel-zgloszenia'], ['Gotowość', '#apanel-gotowosc'], ['Konta', '#apanel-konta']]) {
      const tab = page.getByRole('tab', { name: new RegExp(`^${name}`) });
      await interactive(tab);
      await tab.click();
      await page.locator(panel).waitFor({ state: 'visible' });
      await page.waitForLoadState('networkidle').catch(() => {});
      const o = await overflow(page);
      if (o > 0) found.push(`${name}: poziome przewijanie o ${o} px`);
      for (const v of await serious(page)) found.push(`${name}: ${v}`);
    }
    assert.equal(await page.locator('.bottomnav').isVisible(), false);
    assert.ok(await page.locator('.topbar .nav').first().isVisible());
    assert.deepEqual(found, []);
    assert.deepEqual(problems, []);
  } catch (e) { await shot(page, 'komputer-admin'); throw e; } finally { await ctx.close(); }
});
