// Własny układ panelu „Dziś” (POM-48): ukrycie szybkiego wpisu objawów i wykresu w profilu (grupa „Ekran Dziś”, UI 5), zapis na
// koncie (po przeładowaniu dalej ukryte), „Dziś bez zużycia” zostaje bez wykresu, przywrócenie. Konto ania (stan przywracany).
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/uklad-dzis.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
});
after(async () => { await ctx?.close(); await browser?.close(); });

// UI 5: ustawienia ekranu „Dziś” są w profilu; kotwica otwiera grupę
async function prefs() {
  await go(page, '/profil#ekran-dzis');
  const box = page.locator('fieldset.today-layout');
  await box.waitFor({ state: 'visible', timeout: 15000 });
  return box;
}

const saved = (act) => Promise.all([page.waitForResponse((r) => r.url().includes('/api/today-layout') && r.request().method() === 'PUT'), act()]);
const order = () => page.$$eval('.today > .t-cell > *', (els) => els.map((e) => e.className));
async function home() { await go(page, '/'); await page.locator('.kpi-grid, #objawy').first().waitFor({ timeout: 15000 }); }

test('Układ „Dziś”: ukrycie i przywrócenie kart, zapis na koncie', async () => {
  try {
    await home();
    // ekran „Dziś” prowadzi do ustawień w profilu
    await page.getByText('Szczegóły', { exact: true }).click();
    assert.equal(await page.getByRole('link', { name: 'Dostosuj ekran i progi' }).getAttribute('href'), '/profil#ekran-dzis');
    let box = await prefs();
    await saved(() => box.getByRole('checkbox', { name: 'Szybki wpis objawów' }).uncheck());
    await saved(() => box.getByRole('checkbox', { name: 'Wykres 14 dni i prognoza zapasu' }).uncheck());
    await home();
    assert.equal(await page.locator('#objawy').count(), 0);
    assert.equal(await page.locator('.today-chart').count(), 0);
    await shot(page, 'uklad-dzis-ukryte');
    // przywrócenie
    box = await prefs();
    await saved(() => box.getByRole('checkbox', { name: 'Szybki wpis objawów' }).check());
    await saved(() => box.getByRole('checkbox', { name: 'Wykres 14 dni i prognoza zapasu' }).check());
    await home();
    await page.locator('#objawy').waitFor();
    await page.locator('.today-chart').waitFor();
  } catch (e) { await shot(page, 'uklad-dzis'); throw e; }
});

// UI 5 etap 3: gotowy układ „Objawy najpierw” i przesuwanie karty strzałką, zapis na koncie, powrót do „Pełny”
test('Układ „Dziś”: gotowe układy i kolejność kart', async () => {
  try {
    let box = await prefs();
    await saved(() => box.getByRole('radio', { name: /Objawy najpierw/ }).click());
    assert.equal(await box.getByRole('radio', { name: /Objawy najpierw/ }).getAttribute('aria-checked'), 'true');
    await home();
    assert.match((await order())[0], /tsym/);
    // strzałka „w dół” przy objawach: układ staje się własny
    box = await prefs();
    await saved(() => box.getByRole('button', { name: 'Przesuń w dół: Szybki wpis objawów' }).click());
    await box.getByText('Układ własny.').waitFor();
    await home();
    assert.match((await order())[0], /today-todo/, 'kolejność zapisana na koncie');
    box = await prefs();
    await saved(() => box.getByRole('radio', { name: /Pełny/ }).click());
    assert.equal(await box.getByRole('radio', { name: /Pełny/ }).getAttribute('aria-checked'), 'true');
  } catch (e) { await shot(page, 'uklad-dzis-gotowe'); throw e; }
});
