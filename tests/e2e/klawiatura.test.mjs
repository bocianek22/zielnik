// Dostępność, część 2: klawiatura (pułapka fokusu), ustawienie „Większy tekst i przyciski”, prefers-reduced-motion.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, go, hydrated, interactive } from './helpers.mjs';

let browser;
let session;
before(async () => {
  browser = await launch();
  const { ctx } = await phone(browser);
  const page = await ctx.newPage();
  await login(page, 'ania');
  session = await ctx.storageState();
  await ctx.close();
});
after(async () => { await browser?.close(); });

async function open(theme) {
  const { ctx, problems } = await phone(browser, { storageState: session });
  await ctx.addInitScript((t) => { try { localStorage.setItem('zielnik.theme', t); } catch {} }, theme);
  return { ctx, problems, page: await ctx.newPage() };
}

const serious = async (page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

// Arkusz „Więcej” przechwytuje Tab, Escape go zamyka, a fokus wraca na przycisk „Więcej”
test('arkusz „Więcej”: pułapka fokusu, Escape, powrót fokusu, axe w obu motywach', async () => {
  for (const theme of ['light', 'dark']) {
    const { ctx, problems, page } = await open(theme);
    try {
      await go(page, '/profil');
      const more = page.locator('.bottomnav button', { hasText: 'Więcej' });
      await interactive(more);
      await more.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('nav.sheet');
      await page.waitForTimeout(300);
      assert.deepEqual(await serious(page), [], 'axe z otwartym arkuszem');
      const count = await page.locator('nav.sheet a, nav.sheet button').count();
      for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => !!document.activeElement.closest('nav.sheet')), 'fokus ucieka z arkusza');
      }
      await page.keyboard.press('Shift+Tab');
      assert.ok(await page.evaluate(() => !!document.activeElement.closest('nav.sheet')));
      await page.keyboard.press('Escape');
      await page.waitForSelector('nav.sheet', { state: 'detached' });
      assert.ok(await more.evaluate((b) => b === document.activeElement), 'fokus nie wrócił na „Więcej”');
      assert.deepEqual(problems.left(), []);
    } finally { await ctx.close(); }
  }
});

test('„Większy tekst i przyciski”: ustawienie w profilu zapamiętane na urządzeniu, klasa już w pierwszym dokumencie', async () => {
  const { ctx, page } = await open('light');
  try {
    await go(page, '/profil');
    const size = () => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    const base = await size();
    await page.getByLabel(/Większy tekst i przyciski/).check();
    assert.ok(await page.evaluate(() => document.documentElement.classList.contains('big-ui')));
    assert.ok(await size() > base);
    await page.reload({ waitUntil: 'commit' });
    await page.waitForFunction(() => document.documentElement.classList.contains('big-ui'), null, { timeout: 5000 });
    await page.waitForLoadState('load');
    await hydrated(page);
    // przełącznik dostaje stan z klasy dopiero w efekcie po hydratacji; bez czekania uncheck() bywa pusty
    const box = page.getByLabel(/Większy tekst i przyciski/);
    await page.waitForFunction((el) => el.checked, await box.elementHandle(), { timeout: 5000 });
    await box.uncheck();
    assert.equal(await page.evaluate(() => localStorage.getItem('zielnik.big')), null);
    assert.equal(await size(), base);
  } finally { await ctx.close(); }
});

test('prefers-reduced-motion: animacje i przejścia wyłączone', async () => {
  const { ctx, page } = await open('light');
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go(page, '/');
    const d = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('.btn'));
      return { t: s.transitionDuration, a: s.animationName };
    });
    assert.match(d.t, /^0s(, 0s)*$/);
    assert.equal(d.a, 'none');
  } finally { await ctx.close(); }
});
