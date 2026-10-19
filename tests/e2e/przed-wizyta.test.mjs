// „Przed wizytą” (0.94.0) i „Plan wykupu” (0.93.0): karta na „Dziś” przy wizycie w ciągu 7 dni (tytuł, linki do raportu
// z okresem i do „Do omówienia”), brak karty bez takiej wizyty, karta planu wykupu w Receptach; dostępność (axe), 320 px.
// Konto ania (zużycie i recepty z seed.mjs). Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/przed-wizyta.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { BASE, launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page;
const serious = async (p, sel) => (await new AxeBuilder({ page: p }).include(sel).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
const plDay = (offset) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date(Date.now() + offset * 864e5));

before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'ania');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Przed wizytą: karta na „Dziś” tylko przy wizycie w ciągu 7 dni, linki do raportu', async () => {
  const headers = { origin: BASE };
  let id = null;
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/');
    assert.equal(await page.locator('.visit-prep').count(), 0, 'bez bliskiej wizyty karty nie ma');

    const r = await ctx.request.post(`${BASE}/api/visits`, { data: { day: plDay(3), note: '' }, headers });
    assert.ok(r.ok(), `wizyta zapisana (${r.status()})`);
    id = (await r.json()).visit.id;

    await go(page, '/');
    const card = page.locator('.visit-prep');
    await card.waitFor({ timeout: 15000 });
    assert.match(await card.locator('#vp-h').innerText(), /Wizyta za 3 dni/);
    const report = await card.getByRole('link', { name: 'Raport za ten okres' }).getAttribute('href');
    assert.match(report, new RegExp(`^/raport\\?from=\\d{4}-\\d{2}-\\d{2}&to=${plDay(0)}`));
    assert.equal(await card.getByRole('link', { name: /Pytania|Dodaj pytanie/ }).getAttribute('href'), '/raport#dn-h');
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page, '.visit-prep'), []);
    await shot(page, 'przed-wizyta');

    // raport z karty otwiera się za ten sam okres
    await go(page, report);
    await page.locator('.report-sheet, .card.empty').first().waitFor({ timeout: 15000 });
  } catch (e) { await shot(page, 'przed-wizyta'); throw e; } finally {
    if (id) await ctx.request.delete(`${BASE}/api/visits/${id}`, { headers });
  }
});

test('Plan wykupu: karta w Receptach z datą wykupu albo informacją o recepcie', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/recepty');
    const card = page.locator('#plan-wykupu');
    await card.waitFor({ timeout: 15000 });
    assert.ok(await card.locator('.refill-row').count() >= 1, 'co najmniej jeden wiersz planu');
    assert.match(await card.innerText(), /Wykup najpóźniej|Nowa recepta przed/);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    assert.deepEqual(await serious(page, '#plan-wykupu'), []);
  } catch (e) { await shot(page, 'plan-wykupu'); throw e; }
});
