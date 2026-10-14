// Dziennik wizyt (POM-52): zapis wizyty z notatką i następną wizytą, „Cofnij” po usunięciu, tryb dyskretny (rozmyta
// notatka), dostępność (axe), 320 px. Konto ania. Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/wizyty.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).include('#wizyty').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'ania');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Wizyty: zapis z notatką i następną wizytą, usunięcie i „Cofnij”', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/raport');
    const box = page.locator('#wizyty');
    await box.waitFor({ timeout: 15000 });
    await box.locator('#vi-day').fill('2026-10-02');
    await box.locator('#vi-next').fill('2027-01-15');
    await box.locator('#vi-note').fill('e2e wizyta: dawka bez zmian');
    const save = box.getByRole('button', { name: 'Zapisz wizytę' });
    await interactive(save);
    await save.click();
    await page.getByRole('status').filter({ hasText: 'Zapisano wizytę i datę następnej.' }).waitFor();
    const row = box.locator('.visits-list li').filter({ hasText: 'e2e wizyta' });
    await row.waitFor();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page), []);
    await shot(page, 'wizyty');

    await page.reload({ waitUntil: 'load' });
    await row.waitFor({ timeout: 15000 });
    await row.getByRole('button', { name: /^Usuń wizytę/ }).click();
    await page.getByRole('status').filter({ hasText: 'Usunięto wizytę.' }).waitFor();
    assert.equal(await row.count(), 0);
    await page.getByRole('button', { name: 'Cofnij' }).click();
    await row.waitFor();
  } catch (e) { await shot(page, 'wizyty'); throw e; }
});

test('Wizyty w trybie dyskretnym: notatka rozmyta', async () => {
  const { ctx: dctx } = await phone(browser, { discreet: true });
  const p = await dctx.newPage();
  try {
    await login(p, 'ania');
    await go(p, '/raport');
    const note = p.locator('#wizyty .visit-note').filter({ hasText: 'e2e wizyta' });
    await note.waitFor({ timeout: 15000 });
    assert.match(await note.evaluate((e) => getComputedStyle(e).filter), /blur/);
  } catch (e) { await shot(p, 'wizyty-dyskretny'); throw e; } finally { await dctx.close(); }
});
