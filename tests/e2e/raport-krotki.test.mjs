// Raport skrócony (POM-56): przełącznik „Pełny/Skrócony”, bez tabeli tygodni, zakupów i odczuć; tryb zostaje po zmianie
// okresu (gotowy okres i własny zakres); 320 px, axe. Konto ania (dane z seed.mjs).
// Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/raport-krotki.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'ania');
});
after(async () => { await ctx?.close(); await browser?.close(); });

const sheet = () => page.locator('.report-sheet');
const heads = async () => (await sheet().locator('h3').allInnerTexts()).map((t) => t.trim());

test('Raport skrócony: sekcje, zachowanie trybu przy zmianie okresu, 320 px, axe', async () => {
  try {
    await page.setViewportSize({ width: 320, height: 760 });
    await go(page, '/raport');
    await sheet().waitFor({ timeout: 15000 });
    assert.ok((await heads()).includes('Tydzień po tygodniu'), 'pełny raport domyślnie');
    const mode = page.getByRole('navigation', { name: 'Wersja raportu' });
    // linki sprawdzamy przez adres (przejście po kliknięciu na emulowanym telefonie trwa kilka sekund: PDF liczony z góry)
    const short = await mode.getByRole('link', { name: 'Skrócony' }).getAttribute('href');
    assert.match(short, /krotki=1/);
    await go(page, short);
    const h = await heads();
    for (const gone of ['Tydzień po tygodniu', 'Zakupy', 'Odczucia pacjenta (skala 0–10)', 'Objawy w dniach z odmianą']) assert.ok(!h.includes(gone), gone);
    for (const kept of ['Podsumowanie', 'Objawy', 'Recepty w okresie', 'Zużycie według odmian']) assert.ok(h.includes(kept), kept);
    assert.equal(await mode.getByRole('link', { name: 'Skrócony' }).getAttribute('aria-current'), 'page');
    // gotowy okres zachowuje tryb
    const p90 = await page.getByRole('navigation', { name: 'Gotowe okresy' }).getByRole('link', { name: '90 dni' }).getAttribute('href');
    assert.match(p90, /krotki=1/);
    await go(page, p90);
    assert.equal(await page.locator('.report-presets [aria-current="page"]').innerText(), '90 dni');
    assert.equal(await page.locator('form.report-visit input[name="krotki"]').getAttribute('value'), '1', 'okres od wizyty zachowuje tryb');
    assert.ok(!(await heads()).includes('Tydzień po tygodniu'));
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    assert.ok(over <= 0, `poziome przewijanie o ${over} px`);
    // axe w trakcie animacji wejścia widzi półprzezroczysty tekst (jak w dostepnosc.test.mjs)
    await page.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().endTime !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, 3000)),
    ]));
    const res = await new AxeBuilder({ page }).include('.report-filter').include('.report-sheet').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    assert.deepEqual(bad.map((v) => `${v.id}: ${v.nodes.map((n) => `${n.target} ${n.failureSummary}`).join(' | ')}`), []);
    await shot(page, 'raport-krotki');
    // powrót do pełnego
    const full = await mode.getByRole('link', { name: 'Pełny' }).getAttribute('href');
    assert.doesNotMatch(full, /krotki/);
    assert.match(full, /from=.*to=/, 'zachowuje okres');
    await go(page, full);
    assert.ok((await heads()).includes('Tydzień po tygodniu'));
  } catch (e) { await shot(page, 'raport-krotki'); throw e; }
});
