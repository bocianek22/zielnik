// SPO-2: czat grupowy na telefonie (390 px): dwie osoby w jednej grupie (ania właścicielka, bartek członek).
// Grupę zakłada ania przez API, członkostwo bartka wstawiamy w bazie (E2E_DB_URL), bo seed nie ma ich w znajomych.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { BASE, launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, pool;
before(async () => {
  browser = await launch();
  if (process.env.E2E_DB_URL) pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
});
after(async () => { await browser?.close(); await pool?.end(); });

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const serious = async (page) => (await new AxeBuilder({ page }).withTags(TAGS).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

async function as(user, theme = 'light') {
  const { ctx, problems } = await phone(browser);
  await ctx.addInitScript((t) => { try { localStorage.setItem('zielnik.theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await login(page, user);
  return { ctx, problems, page };
}
const bubble = (page, text) => page.locator('.chat-bubble', { hasText: text });
async function say(page, text) {
  const box = page.getByLabel('Wiadomość do grupy');
  await interactive(box);
  await box.fill(text);
  await box.press('Enter');
}

test('czat: wysyłka, polling u drugiej osoby, Shift+Enter, edycja, usunięcie, licznik nieprzeczytanych, zgłoszenie',
  { skip: !process.env.E2E_DB_URL && 'brak E2E_DB_URL', timeout: 120000 }, async () => {
    const A = await as('ania'), B = await as('bartek', 'dark');
    try {
      const created = await A.ctx.request.post(`${BASE}/api/groups`, { data: { name: 'Czat E2E' }, headers: { origin: BASE } });
      const gid = (await created.json()).id;
      assert.ok(gid, 'grupa założona');
      await pool.query(`INSERT INTO group_members (group_id, user_id, role, status) SELECT $1, id, 'member', 'active' FROM users WHERE username = 'bartek'`, [gid]);

      // ania pisze: Enter wysyła, Shift+Enter dodaje nowy wiersz, HTML i link zostają zwykłym tekstem
      await go(A.page, `/grupy/${gid}`);
      assert.match(await A.page.locator('.chat-rule').innerText(), /Nie udzielamy tu porad medycznych\. Nie oferuj sprzedaży ani wymiany leków\./);
      const box = A.page.getByLabel('Wiadomość do grupy');
      await interactive(box);
      await box.fill('pierwszy');
      await box.press('Shift+Enter');
      await box.type('drugi wiersz');
      assert.equal(await box.inputValue(), 'pierwszy\ndrugi wiersz', 'Shift+Enter nie wysyła');
      await box.press('Enter');
      await bubble(A.page, 'drugi wiersz').waitFor();
      await say(A.page, 'Hej <b>bartek</b> https://example.com');
      await bubble(A.page, 'Hej <b>bartek</b>').waitFor();
      assert.equal(await A.page.locator('.chat-body b, .chat-body a').count(), 0, 'treść jako zwykły tekst');
      assert.equal(await A.page.locator('.chat-row.mine').count(), 2);

      // bartek widzi po wejściu, odpowiada, a ania dostaje odpowiedź bez odświeżania (polling co ~5 s)
      await go(B.page, `/grupy/${gid}`);
      await bubble(B.page, 'drugi wiersz').waitFor();
      assert.match(await B.page.locator('.chat-row:not(.mine) .chat-name').first().innerText(), /ania/i);
      assert.match(await B.page.locator('.chat-day').first().innerText(), /Dziś/);
      await say(B.page, 'Cześć ania');
      await bubble(B.page, 'Cześć ania').waitFor();
      await bubble(A.page, 'Cześć ania').waitFor({ timeout: 20000 });
      assert.match(await A.page.locator('.chat-row:not(.mine) .chat-name').last().innerText(), /bartek/i);

      // edycja własnej wiadomości
      await B.page.getByRole('button', { name: /Opcje wiadomości/ }).last().click();
      await B.page.getByRole('button', { name: 'Edytuj' }).click();
      await B.page.getByLabel('Edytuj wiadomość').fill('Cześć Ania!');
      await B.page.getByRole('button', { name: 'Zapisz' }).click();
      await B.page.locator('.chat-bubble', { hasText: 'edytowano' }).waitFor();
      assert.equal(await B.page.locator('.chat-edit').count(), 0);
      assert.match(await B.page.locator('.chat-body', { hasText: 'Cześć Ania!' }).innerText(), /Cześć Ania!/);

      // licznik nieprzeczytanych na liście grup: ania jest poza czatem, bartek pisze
      await go(A.page, '/grupy');
      await say(B.page, 'Czy ktoś jest?');
      await bubble(B.page, 'Czy ktoś jest?').waitFor();
      await A.page.reload({ waitUntil: 'load' });
      await A.page.locator('.list-row', { hasText: 'Czat E2E' }).locator('.nbadge').waitFor();
      const row = A.page.locator('.list-row', { hasText: 'Czat E2E' });
      await interactive(row);
      await row.click();
      await bubble(A.page, 'Czy ktoś jest?').waitFor();

      // zgłoszenie cudzej wiadomości
      await A.page.getByRole('button', { name: /Opcje wiadomości od bartek/ }).last().click();
      await A.page.getByRole('button', { name: 'Zgłoś' }).click();
      await A.page.getByRole('button', { name: 'Wyślij zgłoszenie' }).click();
      await A.page.getByText(/zgłoszenie trafiło do administratora/).waitFor();
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM reports WHERE type = 'message'`)).rows[0].n, 1);

      // dostępność i wygląd w obu motywach
      assert.deepEqual(await serious(A.page), []);
      await shot(A.page, 'czat-jasny');
      assert.deepEqual(await serious(B.page), []);
      await shot(B.page, 'czat-ciemny');

      // właścicielka usuwa wiadomość bartka; bartek po odświeżeniu widzi tylko "Wiadomość usunięta"
      // menu wiadomości zostało otwarte przy zgłoszeniu; „Usuń” w obrębie menu (przycisk „Usuń” przy członku grupy to wyrzucenie z grupy)
      await A.page.locator('.chat-menu').getByRole('button', { name: 'Usuń', exact: true }).click();
      await A.page.locator('.chat-bubble.gone').waitFor();
      await B.page.reload({ waitUntil: 'load' });
      await B.page.locator('.chat-bubble.gone', { hasText: 'Wiadomość usunięta' }).waitFor();
      assert.equal(await B.page.getByText('Czy ktoś jest?').count(), 0);
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM group_messages WHERE body = '' AND deleted_at IS NOT NULL`)).rows[0].n, 1);

      assert.deepEqual(A.problems.left(), []);
      assert.deepEqual(B.problems.left(), []);
    } catch (e) {
      await shot(A.page, 'czat-ania'); await shot(B.page, 'czat-bartek');
      throw e;
    } finally { await A.ctx.close(); await B.ctx.close(); }
  });
