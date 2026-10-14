// /szukaj: grupa „Moje notatki” (POM-17) z wycinkiem i wyróżnieniem, wyszukiwanie bez polskich znaków, tryb dyskretny
// rozmywa wycinek. Uruchomienie: npm run test:e2e (seed.mjs: notatka dnia Ani „Lepiej po zmianie odmiany.”).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Szukaj: „Moje notatki” z wycinkiem, bez polskich znaków, prowadzi do dziennika', async () => {
  try {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, '/szukaj?q=ZMIANIE%20odmiany');
      const sec = page.getByRole('region', { name: 'Moje notatki' });
      await sec.waitFor({ timeout: 15000 });
      const row = sec.locator('.note-hit').first();
      assert.match(await row.innerText(), /Notatka dnia/);
      assert.equal(await row.locator('mark').innerText(), 'zmianie');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(over <= 0, `${width} px: poziome przewijanie o ${over} px`);
    }
    assert.deepEqual(await serious(page), []);
    await shot(page, 'szukaj-notatki');
    await go(page, '/szukaj?q=lepiej');
    await Promise.all([page.waitForURL(/\/dziennik$/), page.getByRole('region', { name: 'Moje notatki' }).locator('a').first().click()]);
  } catch (e) { await shot(page, 'szukaj'); throw e; }
});

test('Szukaj: jedna litera nie przeszukuje notatek', async () => {
  await go(page, '/szukaj?q=l');
  await page.getByRole('region', { name: 'Odmiany' }).waitFor({ timeout: 15000 });
  assert.equal(await page.getByRole('region', { name: 'Moje notatki' }).count(), 0);
});

test('Szukaj w trybie dyskretnym: wycinek notatki rozmyty', async () => {
  const { ctx: dctx } = await phone(browser, { discreet: true });
  const p = await dctx.newPage();
  try {
    await login(p);
    await go(p, '/szukaj?q=lepiej');
    const sub = p.getByRole('region', { name: 'Moje notatki' }).locator('.lr-sub').first();
    await sub.waitFor({ timeout: 15000 });
    assert.match(await sub.evaluate((e) => getComputedStyle(e).filter), /blur/);
  } catch (e) { await shot(p, 'szukaj-dyskretny'); throw e; } finally { await dctx.close(); }
});
