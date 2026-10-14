// Kopia zabezpieczona hasłem (POM-57): zapis w profilu (plik bez jawnej treści), przywracanie: prośba o hasło,
// złe hasło daje komunikat, dobre pokazuje podgląd importu; axe formularza. Konto bartek (podgląd niczego nie zapisuje).
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/kopia-haslo.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'bartek');
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Kopia z hasłem: zapis w profilu, złe i dobre hasło przy przywracaniu', async () => {
  try {
    await go(page, '/profil');
    await page.locator('#moje-dane > summary').click();
    const open = page.getByRole('button', { name: 'Pobierz kopię zabezpieczoną hasłem' });
    await interactive(open);
    await open.click();
    await page.fill('#enc-pw', 'krotkie');
    await page.fill('#enc-pw2', 'krotkie');
    await page.getByRole('button', { name: 'Zapisz zaszyfrowaną kopię' }).click();
    await page.getByRole('alert').filter({ hasText: 'co najmniej 8' }).waitFor();
    await page.fill('#enc-pw', 'tajne-haslo-e2e');
    await page.fill('#enc-pw2', 'tajne-haslo-e2e');
    const res = await new AxeBuilder({ page }).include('.enc-export').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id), []);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Zapisz zaszyfrowaną kopię' }).click()]);
    assert.match(dl.suggestedFilename(), /^kopia-zaszyfrowana-\d{4}-\d{2}-\d{2}\.json$/);
    const path = join(mkdtempSync(join(tmpdir(), 'kopia-')), dl.suggestedFilename());
    await dl.saveAs(path);
    const text = readFileSync(path, 'utf8');
    assert.equal(JSON.parse(text).format, 'zielnik-kopia-szyfrowana');
    assert.doesNotMatch(text, /bartek|symptoms|usage/);
    await page.getByRole('status').filter({ hasText: 'Zapisano zaszyfrowaną kopię' }).waitFor();

    await go(page, '/import');
    await page.locator('#kopia input[type="file"]').setInputFiles(path);
    await page.fill('#restore-pw', 'zle-haslo-123');
    await page.getByRole('button', { name: 'Odszyfruj i pokaż podgląd' }).click();
    await page.getByRole('alert').filter({ hasText: 'Złe hasło' }).waitFor();
    await page.fill('#restore-pw', 'tajne-haslo-e2e');
    await page.getByRole('button', { name: 'Odszyfruj i pokaż podgląd' }).click();
    await page.getByRole('heading', { name: /^Podgląd: kopia-zaszyfrowana-/ }).waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#restore-pw').count(), 0);
  } catch (e) { await shot(page, 'kopia-haslo'); throw e; }
});
