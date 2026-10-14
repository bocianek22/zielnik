// „Rok objawów” (POM-50) w Dzienniku: wybór objawu (aria-pressed), komórki z wartością, wybór dnia i karta dnia,
// dostępność (axe), 320 px bez przewijania w poziomie. Uruchomienie: npm run test:e2e (seed.mjs: objawy Ani z 14 dni).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Rok objawów: wybór objawu, dzień z wartością, karta dnia, 320 px, axe', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/dziennik');
    const box = page.locator('.sym-year');
    await box.waitFor({ timeout: 15000 });
    assert.ok(await box.locator('.cal-c.use').count() >= 14, 'dni z wartością bólu');
    const sleep = box.getByRole('button', { name: 'Jakość snu' });
    await sleep.click();
    assert.equal(await sleep.getAttribute('aria-pressed'), 'true');
    assert.match(await box.locator('table caption').innerText(), /Jakość snu/);
    const day = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date()));
    await box.locator(`.cal-c[data-d="${day}"]`).click();
    assert.match(await box.locator('.cal-read').innerText(), /z 10/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    await page.waitForFunction(() => document.title.trim() !== '');
    const v = (await new AxeBuilder({ page }).include('.sym-year').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
      .violations.filter((x) => x.impact === 'serious' || x.impact === 'critical');
    assert.deepEqual(v, []);
    await shot(page, 'rok-objawow');
    await box.getByRole('button', { name: /^Szczegóły dnia/ }).click();
    await page.getByRole('dialog').locator('.sym-tiles').waitFor({ timeout: 15000 });
  } catch (e) { await shot(page, 'rok-objawow-blad'); throw e; }
});
