// Beta B: rejestracja z dwiema zgodami, ekran ponownej akceptacji dla konta ze starą wersją dokumentów,
// publiczne /regulamin i /prywatnosc (axe w obu motywach, bez logowania). Uruchomienie: npm run test:e2e (seed: kod DEV1).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { BASE, launch, phone, shot, go, interactive } from './helpers.mjs';

let browser;
let pool;
before(async () => {
  browser = await launch();
  if (process.env.E2E_DB_URL) pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
});
after(async () => { await browser?.close(); await pool?.end(); });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const serious = async (page) => (await new AxeBuilder({ page }).withTags(TAGS).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

async function open(theme = 'light') {
  const { ctx, problems } = await phone(browser);
  await ctx.addInitScript((t) => { try { localStorage.setItem('zielnik.theme', t); } catch {} }, theme);
  return { ctx, problems, page: await ctx.newPage() };
}
const click = async (loc) => { await interactive(loc); await loc.click(); };
const dbVersion = async (name) => (await pool.query('SELECT consent_version, consent_at FROM users WHERE username = $1', [name])).rows[0];

test('rejestracja: dwie osobne zgody, serwer odrzuca brak zgody zdrowotnej, zapisuje wersję', { skip: !process.env.E2E_DB_URL && 'brak E2E_DB_URL' }, async () => {
  const { ctx, problems, page } = await open();
  try {
    await go(page, '/register');
    await page.getByLabel('Kod zaproszenia').fill('DEV1');
    await page.getByLabel(/Nazwa użytkownika/).fill('zgoda1');
    await page.getByLabel(/Hasło/).fill('zgoda1-haslo-1');
    await page.getByLabel('Mam ukończone 18 lat').check();
    const terms = page.getByLabel(/Akceptuję/);
    const health = page.getByLabel(/Wyrażam wyraźną zgodę na przetwarzanie danych o moim zdrowiu/);
    assert.equal(await terms.count(), 1);
    assert.equal(await health.count(), 1);
    assert.equal(await page.locator('.auth-box a[href="/regulamin"]').count(), 1, 'link do regulaminu w rejestracji');
    assert.equal(await page.locator('.auth-box a[href="/prywatnosc"]').count(), 1);
    // tylko regulamin: serwer odmawia (400) i nie zakłada konta
    problems.allow(/400 POST \/api\/auth\/register/, /Failed to load resource.*400/);
    await terms.check();
    await click(page.getByRole('button', { name: 'Załóż konto' }));
    await page.getByRole('alert').filter({ hasText: /zgodę na przetwarzanie danych o zdrowiu/ }).waitFor();
    assert.equal(await dbVersion('zgoda1'), undefined);
    // obie zgody: konto z wersją dokumentów, bez ekranu akceptacji
    await health.check();
    await Promise.all([page.waitForURL((u) => u.pathname === '/profil', { timeout: 15000 }), click(page.getByRole('button', { name: 'Załóż konto' }))]);
    await page.waitForLoadState('load');
    const row = await dbVersion('zgoda1');
    assert.match(row.consent_version, /^\d{4}-\d{2}-beta\d+\.[0-9a-f]{8}$/);
    assert.ok(row.consent_at);
    assert.equal(await page.locator('.consent-gate').count(), 0, 'świeże konto nie widzi ekranu akceptacji');
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'zgoda-rejestracja'); throw e; } finally { await ctx.close(); }
});

test('konto ze starą wersją widzi ekran akceptacji, po akceptacji panel', { skip: !process.env.E2E_DB_URL && 'brak E2E_DB_URL' }, async () => {
  for (const theme of ['light', 'dark']) {
    const name = `zgoda-${theme}`;
    const { ctx, problems, page } = await open(theme);
    try {
      await page.goto(`${BASE}/login`, { waitUntil: 'load' });
      const r = await page.evaluate(async (u) => (await fetch('/api/auth/register', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invite: 'DEV1', username: u, password: `${u}-haslo-1`, adult: true, consent: true, healthConsent: true }),
      })).status, name);
      assert.equal(r, 200);
      // konto sprzed wersjonowania: NULL (drugie konto: wersja z przeszłości)
      await pool.query('UPDATE users SET consent_version = $2 WHERE username = $1', [name, theme === 'light' ? null : '2026-09-stara']);

      await go(page, '/');
      const gate = page.getByRole('dialog', { name: 'Zanim przejdziesz dalej' });
      await gate.waitFor();
      assert.equal(await page.locator('main').first().getAttribute('inert'), '', 'treść pod ekranem jest nieaktywna');
      assert.equal(await gate.locator('a[href="/regulamin"]').count(), 1);
      assert.equal(await gate.locator('a[href="/prywatnosc"]').count(), 1);
      assert.equal(await gate.locator('a[href="/api/account/export"]').count(), 1, 'pobranie danych bez akceptacji');
      assert.equal(await gate.getByRole('button', { name: 'Usuń konto' }).count(), 1);
      assert.deepEqual(await serious(page), [], `axe, ekran akceptacji, motyw ${theme}`);

      const accept = gate.getByRole('button', { name: /Akceptuję i przechodzę dalej/ });
      assert.equal(await accept.isDisabled(), true);
      await gate.getByLabel('Akceptuję regulamin i politykę prywatności').check();
      assert.equal(await accept.isDisabled(), true, 'sama akceptacja regulaminu nie wystarcza');
      await gate.getByLabel(/Wyrażam wyraźną zgodę/).check();
      await Promise.all([page.waitForResponse((r) => r.url().endsWith('/api/account/consent') && r.status() === 200), click(accept)]);
      await page.locator('.consent-gate').waitFor({ state: 'detached', timeout: 15000 });
      assert.equal(await page.locator('[inert]').count(), 0, 'inert zdjęty po akceptacji');
      await page.getByRole('link', { name: 'Zielnik' }).first().waitFor();
      assert.match((await dbVersion(name)).consent_version, /^\d{4}-\d{2}-beta\d+\.[0-9a-f]{8}$/);
      // po przeładowaniu ekran nie wraca
      await go(page, '/profil');
      assert.equal(await page.locator('.consent-gate').count(), 0);
      assert.deepEqual(problems.left(), []);
    } catch (e) { await shot(page, `zgoda-gate-${theme}`); throw e; } finally { await ctx.close(); }
  }
});

test('/regulamin i /prywatnosc: bez logowania, adnotacja o wersji roboczej, axe w obu motywach', async () => {
  for (const theme of ['light', 'dark']) {
    const { ctx, problems, page } = await open(theme);
    try {
      for (const [path, h1] of [['/regulamin', 'Regulamin bety'], ['/prywatnosc', 'Polityka prywatności']]) {
        await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' }); // strona tylko do czytania: bez czekania na hydratację
        assert.equal(new URL(page.url()).pathname, path, 'bez przekierowania na logowanie');
        assert.equal(await page.getByRole('heading', { level: 1 }).innerText(), h1);
        assert.match(await page.getByRole('note').innerText(), /Wersja robocza na czas zamkniętej bety/);
        assert.match(await page.locator('.legal-meta').innerText(), /Wersja dokumentu: \d{4}-\d{2}-beta\d+/);
        assert.deepEqual(await serious(page), [], `${path} (${theme})`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${path}: bez przewijania poziomego`);
      }
      assert.match(await page.locator('main').innerText(), /art\. 9 ust\. 2 lit\. a/);
      assert.deepEqual(problems.left(), []);
    } catch (e) { await shot(page, `prawo-${theme}`); throw e; } finally { await ctx.close(); }
  }
});
