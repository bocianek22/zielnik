// Karta terapii (POM-58): link z Recept, ważne recepty i zapas (dane ani z seed.mjs), lista przypominająca z zastrzeżeniem,
// 320 px, axe; tryb dyskretny: na ekranie nazwy rozmyte, w druku jawne. Uruchomienie: npm run test:e2e (E2E_FILES=...).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

test('Karta terapii: recepty, zapas, lista przypominająca, 320 px, axe', async () => {
  const { ctx } = await phone(browser);
  const page = await ctx.newPage();
  try {
    await login(page, 'ania');
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/recepty');
    const href = await page.getByRole('link', { name: 'Karta terapii na wyjazd' }).getAttribute('href');
    assert.equal(href, '/recepty/karta');
    await go(page, href);
    const card = page.locator('.travel-card');
    await card.waitFor({ timeout: 15000 });
    const heads = await card.locator('h3').allInnerTexts();
    assert.deepEqual(heads, ['Recepty (według zapisów)', 'Zapas (według zapisów w aplikacji)', 'Przed wyjazdem']);
    assert.ok(await card.locator('tbody tr').count() > 0, 'ania ma ważną receptę');
    assert.match(await card.innerText(), /nie porada prawna/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id), []);
    await shot(page, 'karta-terapii');
  } catch (e) { await shot(page, 'karta-terapii'); throw e; } finally { await ctx.close(); }
});

test('Karta terapii w trybie dyskretnym: na ekranie nazwy rozmyte, w druku jawne', async () => {
  const { ctx } = await phone(browser, { discreet: true });
  const page = await ctx.newPage();
  try {
    await login(page, 'ania');
    await go(page, '/recepty/karta');
    const name = page.locator('.travel-card .list-row .dn').first();
    await name.waitFor({ timeout: 15000 });
    assert.match(await name.evaluate((e) => getComputedStyle(e).filter), /blur/);
    await page.emulateMedia({ media: 'print' });
    // rozmycie znika z przejściem (filter .2s): czekamy na stan końcowy
    await page.waitForFunction((el) => getComputedStyle(el).filter === 'none', await name.elementHandle(), { timeout: 5000 });
    assert.equal(await page.locator('.travel-page .hero').isVisible(), false, 'nagłówek strony nie trafia do druku');
    // ciemny motyw: na białej kartce tekst czarny (style druku raportu)
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    for (const sel of ['.travel-card h3', '.travel-card .lr-value', '.travel-card th']) {
      assert.equal(await page.locator(sel).first().evaluate((e) => getComputedStyle(e).color), 'rgb(0, 0, 0)', sel);
    }
  } catch (e) { await shot(page, 'karta-terapii-dyskretny'); throw e; } finally { await ctx.close(); }
});
