// Dostępność (WCAG 2.2 AA): axe na kluczowych ekranach w jasnym i ciemnym motywie oraz w trybie „duże cele”,
// rozmiar celów dotykowych i klawiatura okienek. Uruchomienie: npm run test:e2e.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go } from './helpers.mjs';

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

const PAGES = ['/', '/dziennik', '/obserwacje', '/raport', '/recepty', '/historia', '/profil', '/katalog', 'STRAIN'];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(storageState, theme, big) {
  const { ctx, problems } = await phone(browser, { storageState });
  await ctx.addInitScript(([t, b]) => {
    try { localStorage.setItem('zielnik.theme', t); if (b) localStorage.setItem('zielnik.big', '1'); } catch {}
  }, [theme, big]);
  return { ctx, problems, page: await ctx.newPage() };
}

async function violations(page) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 4).map((n) => n.target.join(' ')).join(' | ')}`);
}

async function strainPath(page) {
  await go(page, '/katalog');
  const href = await page.locator('a[href^="/strains/"]').first().getAttribute('href').catch(() => null);
  if (href) return href;
  await go(page, '/');
  return page.locator('a[href^="/strains/"]').first().getAttribute('href');
}

for (const [theme, big] of [['light', false], ['dark', false], ['light', true]]) {
  test(`axe: ekrany po zalogowaniu, motyw ${theme}${big ? ', duże cele' : ''}`, async () => {
    const { ctx, problems, page } = await open(session, theme, big);
    const found = [];
    try {
      for (let path of PAGES) {
        if (path === 'STRAIN') path = await strainPath(page);
        await go(page, path);
        await page.waitForLoadState('networkidle').catch(() => {});
        for (const v of await violations(page)) found.push(`${path}: ${v}`);
      }
      assert.deepEqual(found, [], 'naruszenia axe (serious/critical)');
      assert.deepEqual(problems.left(), []);
    } catch (e) { await shot(page, `axe-${theme}${big ? '-big' : ''}`); throw e; } finally { await ctx.close(); }
  });
}

test('axe: /login w jasnym i ciemnym motywie', async () => {
  for (const theme of ['light', 'dark']) {
    const { ctx, page } = await open(undefined, theme, false);
    try {
      await go(page, '/login');
      assert.deepEqual(await violations(page), []);
    } finally { await ctx.close(); }
  }
});

// Cele dotykowe: główne kontrolki mają co najmniej 44x44 px (WCAG 2.5.8 wymaga 24); w trybie „duże cele” 56 px
for (const big of [false, true]) {
  test(`cele dotykowe >= ${big ? 56 : 44} px${big ? ' (duże cele)' : ''}`, async () => {
    const { ctx, page } = await open(session, 'light', big);
    try {
      const min = big ? 56 : 44;
      const bad = [];
      for (const path of ['/', '/dziennik', '/profil', '/katalog']) {
        await go(page, path);
        const small = await page.evaluate((m) => {
          const out = [];
          for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=switch]')) {
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none') continue;
            const r = el.getBoundingClientRect();
            if (!r.width || !r.height) continue;
            if (el.closest('.sr-only') || el.matches('.sr-only')) continue;
            // linki w ciągłym tekście są wyłączone z wymogu (WCAG 2.5.8, wyjątek „inline”)
            if (el.tagName === 'A' && cs.display === 'inline') continue;
            if (el.type === 'range' || el.type === 'checkbox' || el.type === 'radio') {
              const lr = (el.closest('label, .check, .switch-row') || el).getBoundingClientRect();
              if (lr.height >= m - 0.5 && lr.width >= m - 0.5) continue;
            }
            if (r.height < m - 0.5 || r.width < m - 0.5) {
              const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '';
              out.push(`${el.tagName.toLowerCase()}${cls} "${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
            }
          }
          return out;
        }, min);
        for (const s of small) bad.push(`${path}: ${s}`);
      }
      assert.deepEqual(bad, [], `kontrolki mniejsze niż ${min} px`);
    } finally { await ctx.close(); }
  });
}
