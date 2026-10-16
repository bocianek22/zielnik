// Własne pomiary (POM-63): dodanie pomiaru z podpowiedzi i własnego, zapis z przecinkiem, lista ostatnich, karta w raporcie,
// usunięcie z potwierdzeniem, dostępność (axe), 320 px. Konto bartek.
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/pomiary.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).include('#pomiary').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'bartek');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Pomiary: dodanie, zapis z przecinkiem, raport, usunięcie', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/dziennik');
    const box = page.locator('#pomiary');
    await box.waitFor({ timeout: 15000 });
    await interactive(box.locator('summary').first());
    await box.locator('summary').first().click();
    const hint = box.getByRole('button', { name: 'Tętno (ud./min)' });
    await interactive(hint);
    await hint.click();
    await page.getByRole('status').filter({ hasText: 'Dodano pomiar.' }).waitFor();
    await box.locator('#ms-name').fill('Glukoza');
    await box.locator('#ms-unit').fill('mg/dl');
    await box.getByRole('button', { name: 'Dodaj pomiar' }).click();
    await box.getByLabel('Glukoza (mg/dl)').waitFor();
    await box.getByLabel('Tętno (ud./min)').fill('72,5');
    await box.getByLabel('Glukoza (mg/dl)').fill('98');
    await box.getByRole('button', { name: 'Zapisz pomiary' }).click();
    await page.getByRole('status').filter({ hasText: 'Zapisano pomiary.' }).waitFor();
    const row = box.locator('.measures-list li').first();
    await row.waitFor();
    assert.match(await row.innerText(), /Tętno 72,5 ud\.\/min/);
    assert.match(await row.innerText(), /Glukoza 98 mg\/dl/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page), []);
    await shot(page, 'pomiary');

    // po przeładowaniu pole ma zapisaną wartość, a błędna liczba daje komunikat
    await page.reload({ waitUntil: 'load' });
    await box.getByLabel('Tętno (ud./min)').waitFor({ timeout: 15000 });
    assert.equal(await box.getByLabel('Tętno (ud./min)').inputValue(), '72,5');
    await interactive(box.getByRole('button', { name: 'Zapisz pomiary' }));
    await box.getByLabel('Glukoza (mg/dl)').fill('dużo');
    await box.getByRole('button', { name: 'Zapisz pomiary' }).click();
    await box.getByRole('alert').filter({ hasText: 'Wpisz liczbę' }).waitFor();

    await go(page, '/raport');
    await page.locator('.report-sheet').first().getByText(/Glukoza: najmniej 98 mg\/dl/).waitFor({ timeout: 15000 });

    await go(page, '/dziennik');
    await box.locator('.measures-manage summary').click(); // karta z pomiarami jest otwarta, zarządzanie zwinięte
    page.once('dialog', (d) => d.accept());
    await box.getByRole('button', { name: 'Usuń pomiar: Glukoza' }).click();
    await page.getByRole('status').filter({ hasText: 'Usunięto pomiar.' }).waitFor();
    assert.equal(await box.getByLabel('Glukoza (mg/dl)').count(), 0);
  } catch (e) { await shot(page, 'pomiary'); throw e; }
});
