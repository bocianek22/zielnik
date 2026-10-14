// Karta odmiany i lista: menu zdjęcia z formularzem zgłoszenia nie jest przycięte przez nagłówek (overflow: hidden),
// arkusz „…” w wierszu blokuje przewijanie tła. Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/odmiana.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page, pool;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
  pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
});
after(async () => { await pool?.end(); await ctx?.close(); await browser?.close(); });

test('Menu zdjęcia: formularz zgłoszenia widoczny w całości na 320 px', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 700 });
    const { rows } = await pool.query(`SELECT strain_id AS id FROM strain_photos LIMIT 1`);
    await go(page, `/strains/${rows[0].id}`);
    const btn = page.getByRole('button', { name: 'Opcje zdjęcia' });
    await interactive(btn);
    assert.equal(await btn.getAttribute('aria-expanded'), 'false');
    await btn.click();
    assert.equal(await btn.getAttribute('aria-expanded'), 'true');
    await page.getByRole('button', { name: 'Zgłoś zdjęcie' }).click();
    const send = page.getByRole('button', { name: 'Wyślij zgłoszenie' });
    await send.waitFor();
    // przycisk na dole formularza musi leżeć w obrębie nagłówka (nie jest ucięty)
    const [hero, b] = await Promise.all([page.locator('.dhero').boundingBox(), send.boundingBox()]);
    assert.ok(b.y + b.height <= hero.y + hero.height, `przycisk poza nagłówkiem: ${b.y + b.height} > ${hero.y + hero.height}`);
    await page.getByRole('button', { name: 'Anuluj' }).click();
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
  } catch (e) { await shot(page, 'odmiana-menu-zdjecia'); throw e; }
});

test('Arkusz „…” w wierszu odmiany blokuje przewijanie tła', async () => {
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, '/odmiany');
    const more = page.locator('.card-menu-btn').first();
    await interactive(more);
    await more.click();
    await page.locator('.row-sheet').waitFor();
    assert.equal(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
    await page.keyboard.press('Escape');
    await page.locator('.row-sheet').waitFor({ state: 'detached' });
    assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).overflow), 'hidden');
  } catch (e) { await shot(page, 'odmiana-arkusz'); throw e; }
});
