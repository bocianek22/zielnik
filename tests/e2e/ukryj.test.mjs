// „Ukryj nazwy teraz” i dyskrecja po wyjściu z aplikacji (POM-60) oraz „Ostatnia kopia” (POM-61). Konto bartek.
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/ukryj.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const discreet = (page) => page.evaluate(() => document.documentElement.dataset.discreet === '1');

test('Ukryj nazwy: przełącznik w arkuszu „Więcej” (stała nazwa, aria-pressed) działa w obie strony', async () => {
  const { ctx } = await phone(browser);
  const page = await ctx.newPage();
  try {
    await login(page, 'bartek');
    await go(page, '/');
    const more = page.locator('.bottomnav button', { hasText: 'Więcej' });
    await interactive(more);
    await more.click();
    const hide = page.locator('nav.sheet').getByRole('button', { name: /^Ukryj nazwy/ });
    assert.equal(await hide.getAttribute('aria-pressed'), 'false');
    await hide.click();
    assert.equal(await discreet(page), true);
    assert.equal(await page.title(), 'Notatnik');
    assert.equal(await hide.getAttribute('aria-pressed'), 'true');
    await hide.click();
    assert.equal(await discreet(page), false);
  } catch (e) { await shot(page, 'ukryj-teraz'); throw e; } finally { await ctx.close(); }
});

test('Dyskrecja po wyjściu: z opcją w profilu tryb włącza się, gdy strona schodzi do tła', async () => {
  const { ctx } = await phone(browser);
  const page = await ctx.newPage();
  try {
    await login(page, 'bartek');
    await go(page, '/profil#bezpieczenstwo');
    const leave = () => page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
    await leave();
    assert.equal(await discreet(page), false, 'bez opcji nic się nie dzieje');
    const sw = page.getByRole('switch', { name: /Włączaj sam po wyjściu z aplikacji/ });
    await interactive(sw);
    await sw.check();
    await leave();
    assert.equal(await discreet(page), true);
    await page.reload({ waitUntil: 'load' });
    // stan z urządzenia (localStorage) pojawia się po hydratacji
    const again = page.getByRole('switch', { name: /Włączaj sam po wyjściu z aplikacji/ });
    await interactive(again);
    await page.waitForFunction((el) => el.checked, await again.elementHandle(), { timeout: 5000 });
  } catch (e) { await shot(page, 'ukryj-po-wyjsciu'); throw e; } finally { await ctx.close(); }
});

test('Ostatnia kopia: po pobraniu danych profil pokazuje dzisiejszą datę', async () => {
  const { ctx } = await phone(browser);
  const page = await ctx.newPage();
  try {
    await login(page, 'bartek');
    await go(page, '/profil');
    await page.locator('#moje-dane > summary').click();
    const line = page.locator('.last-backup');
    assert.match(await line.innerText(), /nie pobrano jeszcze kopii/);
    // zapis daty dopiero po udanym pobraniu (fetch + plik), nie przy samym kliknięciu
    const link = page.getByRole('link', { name: 'Pobierz dane (JSON)' });
    await interactive(link);
    await Promise.all([page.waitForEvent('download'), link.click()]);
    await page.waitForFunction(() => /dziś/.test(document.querySelector('.last-backup')?.textContent || ''));
  } catch (e) { await shot(page, 'ostatnia-kopia'); throw e; } finally { await ctx.close(); }
});
