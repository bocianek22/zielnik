// Karta dnia (0.60.0): wybór dnia w kalendarzu Historii otwiera arkusz z zużyciem, objawami i notatką dnia, skrót do wpisu
// w Dzienniku na ten dzień; dostępność arkusza (axe), 320 px bez przewijania w poziomie, tryb dyskretny rozmywa nazwy i notatkę.
// Uruchomienie: npm run test:e2e (seed.mjs: zużycie i objawy Ani z dziś, notatka „Lepiej po zmianie odmiany.”).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).include('.day-card').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
});
after(async () => { await ctx?.close(); await browser?.close(); });

const today = () => page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date()));

async function openCard(p, day) {
  await go(p, '/historia');
  const cell = p.locator(`.cal-c[data-d="${day}"]`);
  await cell.waitFor({ timeout: 15000 });
  await cell.click();
  await p.getByRole('button', { name: /^Szczegóły dnia/ }).click();
  const dlg = p.getByRole('dialog');
  await dlg.locator('.dc-list, .sym-tiles').first().waitFor({ timeout: 15000 });
  return dlg;
}

test('Karta dnia: zużycie, objawy i notatka z dziś; skrót do Dziennika na ten dzień', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 740 });
    const day = await today();
    const dlg = await openCard(page, day);
    const text = await dlg.innerText();
    assert.match(text, /Zużycie/);
    assert.match(text, /Objawy/);
    assert.match(text, /Lepiej po zmianie odmiany\./);
    assert.doesNotMatch(text, /lepszy dzień|gorszy dzień|ocena dnia/i, 'bez ocen dnia');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page), []);
    await shot(page, 'karta-dnia');
    await Promise.all([page.waitForURL(new RegExp(`/dziennik\\?dzien=${day}$`)), dlg.getByRole('link', { name: 'Zmień wpis objawów' }).click()]);
    assert.equal(await page.locator('#sd').inputValue().catch(() => day), day);
  } catch (e) { await shot(page, 'karta-dnia-blad'); throw e; }
});

test('Karta dnia: Escape zamyka arkusz', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dlg = await openCard(page, await today());
  await page.keyboard.press('Escape');
  await dlg.waitFor({ state: 'detached' });
});

test('Karta dnia w trybie dyskretnym: nazwy odmian i notatka rozmyte', async () => {
  const { ctx: dctx } = await phone(browser, { discreet: true });
  const p = await dctx.newPage();
  try {
    await login(p);
    const day = await p.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date()));
    const dlg = await openCard(p, day);
    const blurs = await dlg.locator('.dn').evaluateAll((els) => els.map((e) => getComputedStyle(e).filter));
    assert.ok(blurs.length > 0 && blurs.every((f) => /blur/.test(f)), String(blurs));
  } catch (e) { await shot(p, 'karta-dnia-dyskretny'); throw e; } finally { await dctx.close(); }
});
