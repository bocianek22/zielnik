// Ochrona ekranu w APK (POM-59): sekcja w profilu tylko w aplikacji z wtyczką ZielnikScreen (atrapa powłoki), przełącznik
// wysyła ustawienie do wtyczki i pokazuje stan; w przeglądarce i w starszym APK sekcji nie ma.
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/ochrona-ekranu.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const shell = (withScreen) => {
  const calls = (window.__screen = { set: [], secure: false });
  Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) ZielnikApp/0.7.0' });
  window.Capacitor = { isNativePlatform: () => true, Plugins: withScreen ? {
    ZielnikScreen: {
      get: async () => ({ secure: calls.secure }),
      set: async ({ secure }) => { calls.set.push(secure); calls.secure = secure; return { secure }; },
    },
  } : {} };
};

const section = (page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Ochrona ekranu' }) });

test('Ochrona ekranu: przełącznik w APK z wtyczką włącza i wyłącza FLAG_SECURE', async () => {
  const { ctx } = await phone(browser);
  await ctx.addInitScript(shell, true);
  const page = await ctx.newPage();
  try {
    await login(page);
    await go(page, '/profil#bezpieczenstwo');
    const sw = page.getByRole('switch', { name: 'Blokuj zrzuty ekranu i podgląd w przełączniku' });
    await sw.waitFor({ timeout: 15000 });
    await interactive(sw);
    assert.equal(await sw.isChecked(), false, 'domyślnie wyłączone');
    await sw.click();
    await section(page).getByRole('status').filter({ hasText: 'Włączono' }).waitFor();
    assert.equal(await sw.isChecked(), true);
    await sw.click();
    await section(page).getByRole('status').filter({ hasText: 'Wyłączono' }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.__screen.set), [true, false]);
  } catch (e) { await shot(page, 'ochrona-ekranu'); throw e; } finally { await ctx.close(); }
});

test('Ochrona ekranu: brak sekcji w przeglądarce i w starszym APK', async () => {
  for (const native of [false, true]) {
    const { ctx } = await phone(browser);
    if (native) await ctx.addInitScript(shell, false);
    const page = await ctx.newPage();
    try {
      await login(page);
      await go(page, '/profil');
      await page.getByRole('heading', { name: 'Mój profil' }).waitFor({ timeout: 15000 });
      await page.waitForTimeout(500); // sekcja pojawia się po sprawdzeniu wtyczki (efekt po hydratacji)
      assert.equal(await page.getByRole('heading', { name: 'Ochrona ekranu' }).count(), 0, native ? 'starsze APK' : 'przeglądarka');
    } catch (e) { await shot(page, 'ochrona-ekranu-brak'); throw e; } finally { await ctx.close(); }
  }
});
