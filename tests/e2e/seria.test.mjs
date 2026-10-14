// Seria wpisów objawów (POM-08) na „Dziś” i w Dzienniku: tekst bez presji, 7 kropek z opisem dla czytnika, tryb dyskretny bez słów o temacie.
// „Samopoczucie po tej odmianie” (POM-18) w karcie odmiany: tabela z podpisem, zastrzeżenie, bez przewijania w poziomie na 320 px.
// Uruchomienie: npm run test:e2e (seed.mjs: wpisy objawów Ani z ostatnich 14 dni).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page, pool;
const serious = async (p) => (await p.waitForFunction(() => document.title.trim() !== ''), await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
  pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
});
after(async () => { await pool?.end(); await ctx?.close(); await browser?.close(); });

const checkStreak = async (p, where) => {
  const s = p.getByTestId('streak');
  await s.waitFor({ timeout: 15000 });
  assert.match(await s.innerText(), /Wpisy: 14 dni z rzędu/, where);
  assert.equal(await s.locator('.streak-dots i.on').count(), 7, where);
  assert.equal(await s.locator('.streak-dots').getAttribute('aria-label'), 'Ostatnie 7 dni: wpis w 7 dniach');
  assert.doesNotMatch(await s.innerText(), /zerw|stracisz|brawo|!/i, `${where}: bez presji i zachęt`);
};

test('Seria wpisów: na „Dziś” i w Dzienniku, dostępna i bez presji', async () => {
  try {
    await go(page, '/');
    await checkStreak(page, 'Dziś');
    assert.deepEqual(await serious(page), []);
    await go(page, '/dziennik');
    await checkStreak(page, 'Dziennik');
    assert.deepEqual(await serious(page), []);
    await shot(page, 'seria-dziennik');
  } catch (e) { await shot(page, 'seria'); throw e; }
});

test('Seria wpisów w trybie dyskretnym: tekst neutralny', async () => {
  const { ctx: dctx } = await phone(browser, { discreet: true });
  const p = await dctx.newPage();
  try {
    await login(p);
    await go(p, '/');
    const s = p.getByTestId('streak');
    await s.waitFor({ timeout: 15000 });
    assert.doesNotMatch(await s.innerText(), /objaw|konop|odmian|ból/i);
  } catch (e) { await shot(p, 'seria-dyskretny'); throw e; } finally { await dctx.close(); }
});

test('Samopoczucie po odmianie: sekcja w karcie odmiany z zastrzeżeniem, bez przewijania w poziomie', async () => {
  try {
    const { rows } = await pool.query(`SELECT s.id FROM strains s JOIN users u ON u.username = 'ania'
      JOIN usage_log l ON l.strain_id = s.id AND l.user_id = u.id WHERE s.name = 'Lemon Skunk' LIMIT 1`);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, `/strains/${rows[0].id}`);
      const fold = page.locator('details.dfeel');
      await fold.waitFor({ timeout: 15000 });
      await fold.locator('summary').click();
      assert.match(await fold.locator('summary').innerText(), /Samopoczucie po tej odmianie/);
      const text = await fold.innerText();
      assert.match(text, /nie porada ani ocena skuteczności/);
      assert.doesNotMatch(text, /[↑↓▲▼]|lepiej|gorzej/i);
      if (await fold.locator('table').count()) {
        assert.match(await fold.locator('table caption').innerText(), /ostatnich 90 dni/);
        assert.match(await fold.locator('thead').innerText(), /Z tą odmianą[\s\S]*Bez zużycia/);
      }
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(over <= 0, `${width} px: poziome przewijanie o ${over} px`);
    }
    assert.deepEqual(await serious(page), []);
    await shot(page, 'samopoczucie-odmiana');
  } catch (e) { await shot(page, 'samopoczucie'); throw e; }
});
