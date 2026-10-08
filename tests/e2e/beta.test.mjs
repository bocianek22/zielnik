// BETA-A: „Zgłoś uwagę” (formularz, panel admina, status u autora), „Co nowego” raz po aktualizacji, strona „Pomoc”
// (axe w obu motywach, 320 px), tryb dyskretny bez nazw aplikacji. Uruchomienie: npm run test:e2e (zakłada seed.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { BASE, launch, phone, login, go, interactive } from './helpers.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

let browser;
const sessions = {};
before(async () => {
  browser = await launch();
  for (const user of ['ania', 'Bocian']) {
    const { ctx } = await phone(browser);
    const page = await ctx.newPage();
    await login(page, user);
    sessions[user] = await ctx.storageState();
    await ctx.close();
  }
});
after(async () => { await browser?.close(); });

async function open(user, { theme = 'light', discreet = false, init } = {}) {
  const { ctx, problems } = await phone(browser, { storageState: sessions[user], discreet });
  await ctx.addInitScript(([t, i]) => {
    try { localStorage.setItem('zielnik.theme', t); } catch {}
    // jednorazowo na kartę: przeładowanie nie ma nadpisywać stanu, który test sprawdza
    try { if (i && !sessionStorage.getItem('e2e.init')) { sessionStorage.setItem('e2e.init', '1'); for (const [k, v] of Object.entries(i)) localStorage.setItem(k, v); } } catch {}
  }, [theme, init || null]);
  return { ctx, problems, page: await ctx.newPage() };
}

const serious = async (page) => (await new AxeBuilder({ page }).withTags(TAGS).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
const click = async (loc) => { await interactive(loc); await loc.click(); };

test('zgłoszenie z formularza: arkusz „Więcej”, widoczne u admina, zmiana statusu, autor widzi status', async () => {
  const text = `Przycisk nie reaguje po zapisie ${Date.now()}`;
  const tester = await open('ania');
  try {
    await go(tester.page, '/profil');
    await click(tester.page.locator('.bottomnav button', { hasText: 'Więcej' }));
    await tester.page.waitForSelector('nav.sheet');
    await click(tester.page.locator('nav.sheet a', { hasText: 'Zgłoś uwagę' }));
    await tester.page.waitForURL(/\/uwagi/);
    await tester.page.getByRole('heading', { name: 'Zgłoś uwagę', level: 1 }).waitFor();
    // ekran z arkusza trafia do adresu, link do grupy testerów jest widoczny (BETA_GROUP_URL z e2e.sh)
    assert.match(tester.page.url(), /ekran=%2Fprofil/);
    assert.equal(await tester.page.getByRole('link', { name: /grupy testerów/ }).getAttribute('href'), 'https://grupa.example.test/beta');
    await click(tester.page.getByRole('radio', { name: 'Coś nie działa' }));
    const area = tester.page.getByLabel('Opis');
    await interactive(area);
    await area.fill(text);
    await click(tester.page.getByRole('button', { name: 'Wyślij' }));
    await tester.page.getByRole('status').filter({ hasText: /Zgłoszenie nr \d+ trafiło/ }).waitFor();
    const row = tester.page.locator('.fb-row', { hasText: text });
    await row.waitFor();
    assert.match(await row.innerText(), /Nowe/);
    assert.deepEqual(tester.problems.left(), []);

    const admin = await open('Bocian');
    try {
      await go(admin.page, '/admin');
      await click(admin.page.getByRole('tab', { name: /Zgłoszenia/ }));
      const item = admin.page.locator('li.admin-report', { hasText: text });
      await item.waitFor();
      assert.match(await item.innerText(), /ania/);
      assert.match(await item.innerText(), /\/profil/, 'ekran w danych technicznych');
      assert.match(await item.innerText(), /v\d+\.\d+\.\d+/);
      const select = item.getByLabel('Status');
      await interactive(select);
      await select.selectOption('zrobione');
      await item.locator('.badge', { hasText: 'Zrobione' }).waitFor();
      assert.deepEqual(admin.problems.left(), []);
    } finally { await admin.ctx.close(); }

    await go(tester.page, '/uwagi');
    assert.match(await tester.page.locator('.fb-row', { hasText: text }).innerText(), /Zrobione/);
  } finally { await tester.ctx.close(); }
});

test('„Co nowego”: raz po zmianie wersji; pierwsze uruchomienie tylko zapisuje wersję', async () => {
  const fresh = await open('ania');
  try {
    await go(fresh.page, '/profil');
    assert.equal(await fresh.page.getByRole('dialog', { name: 'Co nowego' }).count(), 0);
    // wersję zapisuje efekt po hydratacji: czekamy, zamiast czytać od razu
    await fresh.page.waitForFunction((v) => localStorage.getItem('zielnik.seenVersion') === v, VERSION, { timeout: 5000 });
  } finally { await fresh.ctx.close(); }

  const { ctx, problems, page } = await open('ania', { init: { 'zielnik.seenVersion': '0.44.0' } });
  try {
    await go(page, '/profil');
    const dlg = page.getByRole('dialog', { name: 'Co nowego' });
    await dlg.waitFor();
    assert.match(await dlg.innerText(), new RegExp(`Wersja ${VERSION.replace(/\./g, '\\.')}`));
    assert.deepEqual(await serious(page), [], 'axe z otwartym oknem');
    await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('.wn')), 'fokus w oknie');
    await click(dlg.getByRole('button', { name: 'Rozumiem' }));
    await dlg.waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => localStorage.getItem('zielnik.seenVersion')), VERSION);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    assert.equal(await page.getByRole('dialog', { name: 'Co nowego' }).count(), 0, 'okno nie wraca po przeładowaniu');
    // numer wersji i oznaczenie Beta w profilu
    const about = page.locator('section[aria-labelledby="about-h"]');
    assert.match(await about.innerText(), new RegExp(`v${VERSION.replace(/\./g, '\\.')}`));
    assert.match(await about.innerText(), /Beta/);
    assert.deepEqual(problems.left(), []);
  } finally { await ctx.close(); }
});

for (const theme of ['light', 'dark']) {
  test(`pomoc i uwagi: axe, motyw ${theme}; brak poziomego przewijania przy 320 px`, async () => {
    const { ctx, problems, page } = await open('ania', { theme });
    try {
      for (const path of ['/pomoc', '/uwagi']) {
        await go(page, path);
        await page.waitForTimeout(250);
        assert.deepEqual(await serious(page), [], `axe ${path}`);
        await page.setViewportSize({ width: 320, height: 700 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `poziome przewijanie ${path} przy 320 px`);
        await page.setViewportSize({ width: 390, height: 844 });
      }
      // pomoc: rozwinięte pytanie nie psuje kontrastu, link do grupy jest
      await go(page, '/pomoc');
      await click(page.locator('details.terp summary').first());
      assert.deepEqual(await serious(page), [], 'axe z rozwiniętym pytaniem');
      assert.equal(await page.getByRole('link', { name: /Grupa testerów/ }).getAttribute('href'), 'https://grupa.example.test/beta');
      assert.deepEqual(problems.left(), []);
    } finally { await ctx.close(); }
  });
}

test('tryb dyskretny: uwagi, pomoc i profil bez nazw aplikacji', async () => {
  const { ctx, problems, page } = await open('ania', { discreet: true });
  try {
    for (const path of ['/uwagi', '/pomoc', '/profil']) {
      await go(page, path);
      await page.waitForFunction(() => document.querySelectorAll('main').length === 1); // loading.js znika po wczytaniu
      assert.doesNotMatch(await page.locator('main').innerText(), /konopi|zielnik/i, path);
    }
    assert.deepEqual(problems.left(), []);
  } finally { await ctx.close(); }
});

test('niezalogowany: /pomoc i /uwagi przekierowują do logowania', async () => {
  const { ctx } = await phone(browser);
  const page = await ctx.newPage();
  try {
    for (const path of ['/pomoc', '/uwagi']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'load' });
      await page.waitForURL((u) => u.pathname.startsWith('/login'), { timeout: 10000 });
    }
  } finally { await ctx.close(); }
});
