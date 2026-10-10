// Historia: porównanie okresów (POM-42) z przełącznikiem Miesiąc/Kwartał, słupki tygodniowe (podpisy osi w karcie na 320 i 390 px,
// strzałki zmieniają odczyt), tryb dyskretny bez nazw odmian w porównaniu. Uruchomienie: npm run test:e2e.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go } from './helpers.mjs';

let browser, ctx, page, problems;
before(async () => {
  browser = await launch();
  ({ ctx, problems } = await phone(browser));
  page = await ctx.newPage();
  await login(page);
});
after(async () => { await ctx?.close(); await browser?.close(); });

test('Historia: porównanie okresów przełącza się na kwartał, ma tabelę dla czytnika i nie wychodzi poza ekran', async () => {
  try {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, '/historia');
      const pc = page.locator('figure.pc');
      await pc.waitFor({ timeout: 15000 });
      const month = pc.getByRole('button', { name: 'Miesiąc' });
      const quarter = pc.getByRole('button', { name: 'Kwartał' });
      assert.equal(await month.getAttribute('aria-pressed'), 'true');
      assert.match(await pc.locator('.pc-legend').innerText(), /Ostatnie 30 dni/);
      await quarter.click();
      assert.equal(await quarter.getAttribute('aria-pressed'), 'true');
      assert.equal(await month.getAttribute('aria-pressed'), 'false');
      assert.match(await pc.locator('.pc-legend').innerText(), /Poprzednie 90 dni/);
      assert.match(await pc.locator('table caption').innerText(), /90 dni/);
      // cel dotykowy przełącznika
      assert.ok((await quarter.boundingBox()).height >= 44, 'przełącznik niższy niż 44 px');
      // różnice bez strzałek
      assert.doesNotMatch(await pc.innerText(), /[↑↓▲▼]/);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(over <= 0, `${width} px: poziome przewijanie o ${over} px`);
    }
  } catch (e) { await shot(page, 'historia-porownanie'); throw e; }
});

test('Historia: podpisy osi słupków tygodniowych mieszczą się w karcie, strzałki zmieniają odczyt', async () => {
  try {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, '/historia');
      const card = page.locator('figure.wk');
      await card.waitFor({ timeout: 15000 });
      const out = await page.evaluate(() => {
        const c = document.querySelector('figure.wk').getBoundingClientRect();
        return [...document.querySelectorAll('figure.wk .wk-axis > span')].filter((s) => {
          const r = s.getBoundingClientRect();
          return r.left < c.left - 0.5 || r.right > c.right + 0.5 || r.bottom > c.bottom + 0.5;
        }).length;
      });
      assert.equal(out, 0, `${width} px: podpisy osi poza kartą`);
      const scrub = card.locator('.wk-scrub');
      if (await scrub.count()) {
        const read = card.locator('.wk-read');
        const before_ = await read.innerText();
        await scrub.focus();
        await page.keyboard.press('Home');
        assert.notEqual(await read.innerText(), before_);
        assert.match(await read.innerText(), /tydzień od \d\d\.\d\d/);
      }
    }
  } catch (e) { await shot(page, 'historia-tygodnie'); throw e; }
});

test('Historia: w trybie dyskretnym porównanie okresów nie ma nazw odmian', async () => {
  const { ctx: dctx } = await phone(browser, { discreet: true });
  const p = await dctx.newPage();
  try {
    await login(p);
    await go(p, '/historia');
    await p.locator('figure.pc').waitFor({ timeout: 15000 });
    assert.equal(await p.locator('figure.pc .dn').count(), 0);
  } catch (e) { await shot(p, 'historia-dyskretny'); throw e; } finally { await dctx.close(); }
});

test('Historia: bez błędów w konsoli', () => {
  assert.deepEqual(problems.left(), []);
});

// A5: kalendarz zużycia (kwartał/rok, 4 stany dnia, klawiatura, tabela dla czytnika) i pora przyjęcia
test('Historia: kalendarz zużycia mieści się w ekranie, przełącza się na rok i reaguje na strzałki', async () => {
  try {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await go(page, '/historia');
      const card = page.locator('figure.cal');
      await card.waitFor({ timeout: 15000 });
      assert.equal(await card.locator('.cal-q').count(), 1);
      const days = await card.locator('.cal-c[data-d]').count();
      assert.ok(days > 80 && days <= 91, `kwartał ma ${days} dni`);
      const size = await card.locator('.cal-c[data-d]').first().evaluate((el) => el.getBoundingClientRect().width);
      assert.ok(size >= (width >= 390 ? 20 : 16), `${width} px: komórka ${size} px`);
      assert.ok(await card.locator('.cal-legend li').count() >= 4, 'legenda');
      assert.equal(await card.locator('.cal-c.is-today[data-d]').count(), 1, 'dziś oznaczone obwódką');
      const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      assert.ok(over <= 0, `${width} px: poziome przewijanie o ${over} px`);
      // klawiatura: strzałka wybiera dzień, odczyt (aria-live) się zmienia, Escape czyści
      const scrub = card.locator('.cal-scrub');
      await scrub.focus();
      const read = card.locator('.cal-read');
      const idle = await read.innerText();
      await page.keyboard.press('ArrowLeft');
      await card.locator('.cal-c.on').waitFor();
      assert.notEqual(await read.innerText(), idle);
      assert.equal(await read.getAttribute('aria-live'), 'polite');
      await page.keyboard.press('Escape');
      assert.equal(await card.locator('.cal-c.on').count(), 0);
      // rok: 4 kwartały, cele przełącznika ≥ 44 px
      const year = card.getByRole('button', { name: 'Rok' });
      assert.ok((await year.boundingBox()).height >= 44);
      await year.click();
      assert.equal(await card.locator('.cal-q').count(), 4);
      assert.ok((await card.locator('.sr-only table').count()) === 1, 'tabela dla czytnika');
    }
  } catch (e) { await shot(page, 'historia-kalendarz'); throw e; }
});

test('Historia: pora przyjęcia ma cztery paski w jednym kolorze i tekst z liczbą wpisów', async () => {
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, '/historia');
    const card = page.locator('figure.per');
    if (!(await card.count())) return; // konto bez wpisów w ostatnich 90 dniach: sekcji nie ma
    assert.equal(await card.locator('.hb-row').count(), 4);
    assert.match(await card.innerText(), /rano[\s\S]*w ciągu dnia[\s\S]*wieczorem[\s\S]*w nocy/);
    assert.equal(await card.locator('.hb-bar:not(.data)').count(), 0);
  } catch (e) { await shot(page, 'historia-pora'); throw e; }
});
