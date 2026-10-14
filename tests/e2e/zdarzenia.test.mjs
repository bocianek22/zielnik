// Znaczniki zdarzeń na wykresie objawów (POM-53): wizyta sprzed 3 dni widoczna jako znacznik pod wykresami, w odczycie
// wybranego dnia i w tabeli dla czytnika ekranu; 320 px. Konto bartek (dane tworzone w teście).
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/zdarzenia.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'bartek');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Wykres objawów: znacznik wizyty, odczyt dnia i tabela', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    const day = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() - 3 * 864e5)));
    const st = await page.evaluate((d) => fetch('/api/visits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ day: d, note: '' }) }).then((r) => r.status), day);
    assert.equal(st, 200);
    await go(page, '/dziennik');
    const mark = page.locator('.sp-events .ev-visit');
    await mark.first().waitFor({ timeout: 15000 });
    const scrub = page.locator('.sp-scrub').first();
    await interactive(scrub);
    await scrub.focus();
    await page.keyboard.press('End');
    for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowLeft');
    assert.match(await page.locator('.sp-read').first().innerText(), /wizyta/);
    assert.match(await page.locator('.sp table').first().innerText(), /wizyta/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    await shot(page, 'zdarzenia');
  } catch (e) { await shot(page, 'zdarzenia'); throw e; }
});
