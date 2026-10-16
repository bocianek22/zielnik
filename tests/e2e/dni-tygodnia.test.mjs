// Wzorce wg dnia tygodnia (POM-54) w „Moich obserwacjach”: sekcja widoczna, stała kolejność Pn–Nd, poniżej progu tylko
// zdanie zamiast pustych pasków, wybór objawu (aria-pressed), 320 px, dostępność (axe). Konto ania (14 dni wpisów z seed.mjs: po 2 dni na dzień
// tygodnia, czyli wszystko poniżej progu). Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/dni-tygodnia.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'ania');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Dni tygodnia: Pn–Nd w tabeli, zdanie poniżej progu, wybór objawu, 320 px, axe', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/obserwacje');
    const box = page.locator('.weekday-obs');
    await box.waitFor({ timeout: 15000 });
    // UI 4: bez żadnej średniej zamiast 7 pustych pasków jedno zdanie; tabela dla czytników nadal ma Pn–Nd i liczby dni
    assert.equal(await box.locator('.hb-lbl').count(), 0);
    assert.match(await box.locator('.wd-none').innerText(), /od 5 dni .* najwięcej 2/);
    assert.deepEqual(await box.locator('tbody td:last-child').allTextContents(), Array(7).fill('2'));
    const pick = box.getByRole('group', { name: 'Objaw w układzie tygodnia' });
    const sleep = pick.getByRole('button', { name: 'Jakość snu' });
    await interactive(sleep);
    await sleep.click();
    assert.equal(await sleep.getAttribute('aria-pressed'), 'true');
    assert.match(await box.locator('caption').innerText(), /^Jakość snu/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    const res = await new AxeBuilder({ page }).include('.weekday-obs').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical'), []);
    await shot(page, 'dni-tygodnia');
  } catch (e) { await shot(page, 'dni-tygodnia'); throw e; }
});
