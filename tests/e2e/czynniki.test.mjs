// Czynniki dnia (POM-47): dodanie z podpowiedzi w Dzienniku, zaznaczenie przy wpisie dnia (przyciski aria-pressed),
// zapis i odczyt po przeładowaniu, sekcja w „Moich obserwacjach”, dostępność (axe), 320 px. Konto bartek (dane z testu).
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/czynniki.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'bartek');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Czynniki dnia: dodanie, zaznaczenie przy wpisie, zapis i odczyt, obserwacje', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/dziennik');
    const mgr = page.locator('details.factor-manager');
    await mgr.waitFor({ timeout: 15000 });
    if (!(await mgr.getAttribute('open'))) await mgr.locator('summary').click();
    for (const h of ['stres', 'ruch']) {
      const chip = mgr.getByRole('button', { name: h, exact: true });
      await interactive(chip);
      await chip.click();
      await mgr.getByRole('listitem').filter({ hasText: h }).waitFor();
    }
    // wpis za wczoraj: ból i czynnik „stres”
    await page.getByRole('button', { name: 'Wczoraj' }).click();
    await page.locator('#sy-pain').fill('6');
    const stres = page.locator('.sym-factors').getByRole('button', { name: 'stres' });
    assert.equal(await stres.getAttribute('aria-pressed'), 'false');
    await stres.click();
    assert.equal(await stres.getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Zapisz wpis' }).click();
    await page.getByRole('status').filter({ hasText: 'Zapisano' }).waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page), []);
    await shot(page, 'czynniki-dziennik');

    await page.reload({ waitUntil: 'load' });
    await page.getByRole('button', { name: 'Wczoraj' }).click();
    const again = page.locator('.sym-factors').getByRole('button', { name: 'stres' });
    await again.waitFor();
    await page.waitForFunction(() => document.querySelector('.sym-factors [aria-pressed="true"]'));
    assert.equal(await again.getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.sym-factors').getByRole('button', { name: 'ruch' }).getAttribute('aria-pressed'), 'false');

    await go(page, '/obserwacje');
    await page.getByRole('heading', { name: 'Czynniki dnia' }).waitFor({ timeout: 15000 });
    assert.match(await page.locator('main').innerText(), /stres/);
  } catch (e) { await shot(page, 'czynniki'); throw e; }
});
