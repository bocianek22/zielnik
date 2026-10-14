// Własny układ panelu „Dziś” (POM-48): ukrycie szybkiego wpisu objawów i wykresu w „Szczegóły i ustawienia”, zapis na
// koncie (po przeładowaniu dalej ukryte), „Dziś bez zużycia” zostaje bez wykresu, przywrócenie. Konto ania (stan przywracany).
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/uklad-dzis.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
});
after(async () => { await ctx?.close(); await browser?.close(); });

async function prefs() {
  const sum = page.locator('details.prefs > summary');
  await interactive(sum);
  if (!(await page.locator('details.prefs').getAttribute('open'))) await sum.click();
  return page.locator('fieldset.today-layout');
}

test('Układ „Dziś”: ukrycie i przywrócenie kart, zapis na koncie', async () => {
  try {
    await go(page, '/');
    await page.locator('#objawy').waitFor({ timeout: 15000 });
    let box = await prefs();
    await box.getByLabel('Szybki wpis objawów').uncheck();
    await box.getByLabel('Wykres 14 dni i prognoza zapasu').uncheck();
    await page.locator('#objawy').waitFor({ state: 'detached' });
    assert.equal(await page.locator('.today-chart').count(), 0);
    // zapis na koncie: po przeładowaniu dalej ukryte
    await page.waitForResponse((r) => r.url().includes('/api/today-layout') && r.request().method() === 'PUT').catch(() => {});
    await page.reload({ waitUntil: 'load' });
    await page.locator('.kpi-grid').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#objawy').count(), 0);
    assert.equal(await page.locator('.today-chart').count(), 0);
    await shot(page, 'uklad-dzis-ukryte');
    // przywrócenie
    box = await prefs();
    await box.getByLabel('Szybki wpis objawów').check();
    await box.getByLabel('Wykres 14 dni i prognoza zapasu').check();
    await page.locator('#objawy').waitFor();
    await page.locator('.today-chart').waitFor();
    await page.waitForTimeout(500);
    await page.reload({ waitUntil: 'load' });
    await page.locator('#objawy').waitFor({ timeout: 15000 });
  } catch (e) { await shot(page, 'uklad-dzis'); throw e; }
});
