// Zdarzenia niepożądane (POM-62): zapis z nasileniem i opisem na /dziennik, informacja o 112 i URPL, „Cofnij” po usunięciu,
// raport (data i nasilenie), tryb dyskretny (rozmyty opis), dostępność (axe), 320 px. Konto ania.
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/niepozadane.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).include('#zdarzenia').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'ania');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Zdarzenia niepożądane: zapis z nasileniem i opisem, usunięcie i „Cofnij”, wpis w raporcie', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/dziennik');
    const box = page.locator('#zdarzenia');
    await box.waitFor({ timeout: 15000 });
    assert.match(await box.innerText(), /112/);
    assert.equal(await box.locator('a[href="https://urpl.gov.pl"]').count(), 1);
    await box.locator('#ae-day').fill(today());
    await box.locator('#ae-note').fill('e2e zdarzenie: zawroty głowy');
    const save = box.getByRole('button', { name: 'Zapisz zdarzenie' });
    await interactive(save);
    await save.click();
    await box.getByRole('alert').filter({ hasText: 'Wybierz nasilenie.' }).waitFor();
    await box.getByRole('button', { name: 'umiarkowane' }).click();
    assert.equal(await box.getByRole('button', { name: 'umiarkowane' }).getAttribute('aria-pressed'), 'true');
    await save.click();
    await page.getByRole('status').filter({ hasText: 'Zapisano zdarzenie.' }).waitFor();
    const row = box.locator('.adverse-list li').filter({ hasText: 'e2e zdarzenie' });
    await row.waitFor();
    assert.match(await row.innerText(), /Nasilenie: umiarkowane/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page), []);
    await shot(page, 'niepozadane');

    await page.reload({ waitUntil: 'load' });
    await row.waitFor({ timeout: 15000 });
    await row.getByRole('button', { name: /^Usuń zdarzenie/ }).click();
    await page.getByRole('status').filter({ hasText: 'Usunięto zdarzenie.' }).waitFor();
    assert.equal(await row.count(), 0);
    await page.getByRole('button', { name: 'Cofnij' }).click();
    await row.waitFor();

    // raport: data i nasilenie zawsze, opis tylko ze spostrzeżeniami
    await go(page, '/raport');
    const sheet = page.locator('.report-sheet').first();
    await sheet.getByRole('heading', { name: 'Zdarzenia niepożądane' }).waitFor({ timeout: 15000 });
    assert.match(await sheet.innerText(), /nasilenie: umiarkowane/);
    assert.doesNotMatch(await sheet.innerText(), /e2e zdarzenie/);
    await go(page, '/raport?notes=1');
    await page.locator('.report-sheet').first().getByText('e2e zdarzenie: zawroty głowy').waitFor({ timeout: 15000 });
  } catch (e) { await shot(page, 'niepozadane'); throw e; }
});

test('Zdarzenia niepożądane w trybie dyskretnym: opis rozmyty', async () => {
  const { ctx: dctx } = await phone(browser, { discreet: true });
  const p = await dctx.newPage();
  try {
    await login(p, 'ania');
    await go(p, '/dziennik');
    const note = p.locator('#zdarzenia .adverse-note').filter({ hasText: 'e2e zdarzenie' });
    await note.waitFor({ timeout: 15000 });
    assert.match(await note.evaluate((e) => getComputedStyle(e).filter), /blur/);
  } catch (e) { await shot(p, 'niepozadane-dyskretny'); throw e; } finally { await dctx.close(); }
});
