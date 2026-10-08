// POM-19 / POM-20: kreator pierwszego uruchomienia (nowe konto z rejestracji przez API) i puste stany prowadzące do pierwszego wpisu.
// Uruchomienie: npm run test:e2e. Kod zaproszenia DEV1 zakłada seed.mjs.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { BASE, launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const serious = async (page) => (await new AxeBuilder({ page }).withTags(TAGS).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

// Rejestracja z przeglądarki (Origin ustawia przeglądarka); sesja zostaje w kontekście
async function register(page, name) {
  await page.goto(`${BASE}/login`, { waitUntil: 'load' });
  const r = await page.evaluate(async (u) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite: 'DEV1', username: u, password: `${u}-haslo-1`, adult: true, consent: true, healthConsent: true }),
    });
    return { status: res.status, body: await res.text() };
  }, name);
  assert.equal(r.status, 200, r.body);
}

async function open({ theme = 'light', discreet = false } = {}) {
  const { ctx, problems } = await phone(browser, { discreet });
  await ctx.addInitScript((t) => { try { localStorage.setItem('zielnik.theme', t); } catch {} }, theme);
  return { ctx, problems, page: await ctx.newPage() };
}

const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const click = async (loc) => { await interactive(loc); await loc.click(); };

test('kreator: nowe konto, axe w obu motywach, 320 px, pominięcie, nie wraca po przeładowaniu ani na innym urządzeniu', async () => {
  const name = 'kreator1';
  const { ctx, problems, page } = await open();
  try {
    await register(page, name);
    await go(page, '/');
    await page.getByRole('heading', { name: 'Pierwsze kroki', level: 1 }).waitFor();
    assert.match(await page.locator('#onb-h').innerText(), /Jaką odmianę/);
    assert.equal(await page.locator('.onb-steps li[aria-current="step"]').count(), 1);
    assert.equal(await page.locator('#onb-q').getAttribute('role'), 'combobox');
    assert.deepEqual(await serious(page), [], 'axe, motyw jasny');
    for (const w of [320, 390]) {
      await page.setViewportSize({ width: w, height: 800 });
      assert.ok(await noHScroll(page), `poziome przewijanie przy ${w} px`);
    }
    // cele dotykowe >= 44 px
    for (const b of await page.locator('.onb button, .onb input:not([type=checkbox]), .onb select').all()) {
      if (!(await b.isVisible())) continue;
      const box = await b.boundingBox();
      assert.ok(box.height >= 43.5, `cel dotykowy ${Math.round(box.height)} px: ${await b.evaluate((e) => e.outerHTML.slice(0, 80))}`);
    }
    await shot(page, 'kreator-jasny-krok1');
    // przełączenie motywu na żywej stronie: bez przejść CSS, inaczej axe mierzy kontrast w połowie animacji tła
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    assert.deepEqual(await serious(page), [], 'axe, motyw ciemny');
    await shot(page, 'kreator-ciemny-krok1');

    // pominięcie wszystkich kroków przyciskami „Pomiń”, fokus na nagłówku kroku
    await click(page.getByRole('button', { name: 'Pomiń ten krok' }));
    await page.waitForFunction(() => document.activeElement?.id === 'onb-h' && /Masz receptę/.test(document.activeElement.textContent));
    await click(page.getByRole('button', { name: 'Pomiń ten krok' }));
    await page.waitForFunction(() => document.activeElement?.id === 'onb-h' && /Przypomnienia/.test(document.activeElement.textContent));
    await page.locator('#remind-hour').waitFor();
    assert.deepEqual(await serious(page), [], 'axe, krok przypomnień');
    await click(page.getByRole('button', { name: 'Dalej', exact: true }));
    await page.waitForFunction(() => document.activeElement?.id === 'onb-h' && /panel/.test(document.activeElement.textContent));
    await click(page.getByRole('button', { name: /Przejdź do panelu/ }));
    await page.locator('.home-date').waitFor();
    assert.equal(await page.locator('.onb').count(), 0);

    // po przeładowaniu kreator nie wraca
    await go(page, '/');
    await page.locator('.home-date').waitFor(); // prawdziwy ekran główny, nie szkielet z loading.js
    assert.equal(await page.locator('.onb').count(), 0);

    // inne urządzenie (nowy kontekst, logowanie hasłem): stan jest na koncie
    const other = await open();
    try {
      await login(other.page, name);
      await go(other.page, '/');
      await other.page.locator('.home-date').waitFor();
      assert.equal(await other.page.locator('.onb').count(), 0);
    } finally { await other.ctx.close(); }
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'kreator-pominiecie'); throw e; } finally { await ctx.close(); }
});

test('kreator: „Zamknij kreator” na pierwszym kroku zapamiętuje się na koncie', async () => {
  const name = 'kreator2';
  const { ctx, problems, page } = await open();
  try {
    await register(page, name);
    await go(page, '/');
    await click(page.getByRole('button', { name: 'Zamknij kreator' }));
    await page.locator('.home-date').waitFor();
    await go(page, '/');
    assert.equal(await page.locator('.onb').count(), 0);
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'kreator-zamkniecie'); throw e; } finally { await ctx.close(); }
});

test('kreator: dodanie odmiany ze stanem i recepty, potem panel „Dziś” z zapasem', async () => {
  const name = 'kreator3';
  const { ctx, problems, page } = await open();
  try {
    await register(page, name);
    await go(page, '/');
    const q = page.locator('#onb-q');
    await interactive(q);
    await q.fill('Lemon');
    const opt = page.getByRole('option').filter({ hasText: 'Lemon Skunk' }).first();
    await opt.waitFor();
    await opt.click();
    await page.waitForFunction(() => document.activeElement?.id === 'onb-amount');
    await page.fill('#onb-amount', '4,5');
    await click(page.getByRole('button', { name: 'Zapisz i dalej' }));
    await page.getByRole('status').filter({ hasText: 'Dodano: Lemon Skunk' }).waitFor();
    assert.match(await page.getByRole('status').filter({ hasText: 'Dodano' }).innerText(), /4,5 g/);
    await page.waitForFunction(() => document.activeElement?.textContent === 'Dalej');
    await shot(page, 'kreator-krok1-zapisany');
    await click(page.getByRole('button', { name: 'Dalej', exact: true }));

    // krok 2: istniejący formularz recept
    await page.locator('#rx-g').waitFor();
    await interactive(page.locator('#rx-g'));
    await page.fill('#rx-g', '10');
    await page.fill('#rx-to', new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10));
    await click(page.getByRole('button', { name: 'Dodaj receptę' }));
    await page.getByRole('status').filter({ hasText: 'Dodano receptę na 10 g' }).waitFor();
    await click(page.getByRole('button', { name: 'Dalej', exact: true }));
    await page.locator('#remind-hour').waitFor();
    await click(page.getByRole('button', { name: 'Dalej', exact: true }));
    assert.match(await page.locator('.onb-sum').innerText(), /Lemon Skunk, 4,5 g[\s\S]*Recepta: 10 g/);
    await click(page.getByRole('button', { name: /Przejdź do panelu/ }));
    await page.locator('.home-date').waitFor();
    await page.locator('.kpi-big').first().waitFor();
    assert.match(await page.locator('.kpi-big').first().innerText(), /4,5\s*g/);
    assert.equal(await page.locator('.trx').count(), 1);
    await shot(page, 'kreator-panel-po');
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'kreator-odmiana'); throw e; } finally { await ctx.close(); }
});

test('kreator w trybie dyskretnym nie zawiera słów „konopie” ani „Zielnik”', async () => {
  const { ctx, page } = await open({ theme: 'dark', discreet: true });
  try {
    await register(page, 'kreator4');
    await go(page, '/');
    await page.locator('.onb').waitFor();
    for (const step of ['strain', 'rx', 'rem', 'end']) {
      assert.doesNotMatch(await page.locator('main').innerText(), /konopi|zielnik/i, `krok ${step}`);
      if (step === 'end') break;
      await click(page.getByRole('button', { name: step === 'rem' ? 'Dalej' : 'Pomiń ten krok', exact: step === 'rem' }));
      await page.waitForFunction(() => document.activeElement?.id === 'onb-h');
    }
    await shot(page, 'kreator-dyskretny');
  } catch (e) { await shot(page, 'kreator-dyskretny-blad'); throw e; } finally { await ctx.close(); }
});

test('puste stany nowego konta: panel „Dziś”, wykres objawów i recepty mają jedną akcję', async () => {
  const { ctx, problems, page } = await open();
  try {
    await register(page, 'kreator5');
    await go(page, '/');
    await click(page.getByRole('button', { name: 'Zamknij kreator' }));
    await page.locator('.home-date').waitFor();
    const today = page.locator('section.empty', { hasText: 'Tu zobaczysz zapas i prognozę' });
    await today.waitFor();
    assert.equal(await today.getByRole('button').count(), 1);
    assert.equal(await today.getByRole('button', { name: 'Dodaj odmianę' }).count(), 1);

    await go(page, '/dziennik');
    const chart = page.locator('section.empty', { hasText: 'Wykres pojawi się po pierwszym wpisie' });
    await chart.waitFor();
    assert.equal(await page.locator('svg.sym-chart').count(), 0, 'pusta siatka zamiast stanu pustego');
    assert.equal(await chart.getByRole('button', { name: 'Wpisz stan' }).count(), 1);

    await go(page, '/recepty');
    const rx = page.locator('.card.empty', { hasText: 'Brak recept' });
    await rx.waitFor();
    assert.equal(await rx.getByRole('button', { name: 'Dodaj receptę' }).count(), 1);
    assert.deepEqual(await serious(page), []);
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'puste-stany'); throw e; } finally { await ctx.close(); }
});
