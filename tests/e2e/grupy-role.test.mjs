// SPO-3: role w grupach na telefonie (390 px): właścicielka (ania) nadaje bartkowi rolę moderatora w liście członków,
// moderator nie może usunąć wiadomości właścicielki (hierarchia ról), a właścicielka odbiera rolę. Członkostwo bartka wstawiamy w bazie (E2E_DB_URL).
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

const serious = async (page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

async function as(user) {
  const { ctx, problems } = await phone(browser);
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  await login(page, user);
  return { ctx, problems, page };
}

test('role w grupie: nadanie moderatora, moderator bez usuwania wiadomości właścicielki, odebranie roli',
  { skip: !process.env.E2E_DB_URL && 'brak E2E_DB_URL', timeout: 120000 }, async () => {
    const A = await as('ania'), B = await as('bartek');
    try {
      const created = await A.ctx.request.post(`${BASE}/api/groups`, { data: { name: 'Role E2E' }, headers: { origin: BASE } });
      const gid = (await created.json()).id;
      assert.ok(gid, 'grupa założona');
      await pool.query(`INSERT INTO group_members (group_id, user_id, role, status) SELECT $1, id, 'member', 'active' FROM users WHERE username = 'bartek'`, [gid]);

      // ania pisze wiadomość; bartek jako zwykły członek nie może jej usunąć (brak „Usuń” w menu)
      await go(A.page, `/grupy/${gid}`);
      const box = A.page.getByLabel('Wiadomość do grupy');
      await interactive(box);
      await box.fill('Wiadomość właścicielki');
      await A.page.getByRole('button', { name: 'Wyślij wiadomość' }).click();
      await A.page.locator('.chat-bubble', { hasText: 'Wiadomość właścicielki' }).waitFor();
      await go(B.page, `/grupy/${gid}`);
      await B.page.locator('.chat-bubble', { hasText: 'Wiadomość właścicielki' }).waitFor();
      await B.page.getByRole('button', { name: /Opcje wiadomości od ania/i }).click();
      assert.equal(await B.page.locator('.chat-menu').getByRole('button', { name: 'Usuń', exact: true }).count(), 0, 'zwykły członek nie usuwa cudzych');
      assert.doesNotMatch(await B.page.locator('.group-head').innerText(), /moderator/i);

      // właścicielka nadaje rolę w liście członków
      const give = A.page.getByRole('button', { name: 'Nadaj rolę moderatora: bartek' });
      await interactive(give);
      assert.ok((await give.boundingBox()).height >= 44, 'przycisk niższy niż 44 px');
      await give.click();
      await A.page.locator('.person-row', { hasText: 'bartek' }).getByText(/Moderator/).waitFor();
      assert.equal(await A.page.getByRole('button', { name: 'Odbierz rolę moderatora: bartek' }).count(), 1);
      assert.deepEqual(await serious(A.page), []);
      await shot(A.page, 'grupy-role-wlasciciel');

      // bartek jako moderator nie ma „Usuń” przy wiadomości właścicielki (usuwa tylko wiadomości zwykłych członków)
      await B.page.reload({ waitUntil: 'load' });
      await B.page.locator('.chat-bubble', { hasText: 'Wiadomość właścicielki' }).waitFor();
      assert.match(await B.page.locator('.group-head').innerText(), /jesteś moderatorem/);
      await B.page.getByRole('button', { name: /Opcje wiadomości od ania/i }).click();
      await B.page.locator('.chat-menu').waitFor();
      assert.equal(await B.page.locator('.chat-menu').getByRole('button', { name: 'Usuń', exact: true }).count(), 0);
      await B.page.keyboard.press('Escape');
      assert.equal((await pool.query(`SELECT count(*)::int AS n FROM group_messages WHERE group_id = $1 AND deleted_at IS NOT NULL`, [gid])).rows[0].n, 0);
      // moderator nie widzi przycisków nadawania ról ani przekazania własności
      assert.equal(await B.page.getByRole('button', { name: /Nadaj rolę moderatora|Przekaż własność/ }).count(), 0);
      assert.deepEqual(await serious(B.page), []);
      await shot(B.page, 'grupy-role-moderator');

      // właścicielka odbiera rolę; bartek od razu traci prawo (API 403)
      await go(A.page, `/grupy/${gid}`);
      await A.page.getByRole('button', { name: 'Odbierz rolę moderatora: bartek' }).click();
      await A.page.getByRole('button', { name: 'Nadaj rolę moderatora: bartek' }).waitFor();
      assert.equal((await pool.query(`SELECT role FROM group_members WHERE group_id = $1 AND user_id = (SELECT id FROM users WHERE username = 'bartek')`, [gid])).rows[0].role, 'member');

      // zasada zapraszania: właścicielka ogranicza do siebie i moderatorów; zwykły członek widzi informację zamiast formularza
      const staffOnly = A.page.getByRole('radio', { name: 'Właściciel i moderatorzy' });
      await interactive(staffOnly);
      await staffOnly.click();
      await A.page.locator('[role=radio][aria-checked=true]', { hasText: 'Właściciel i moderatorzy' }).waitFor();
      assert.deepEqual(await serious(A.page), []);
      await go(B.page, `/grupy/${gid}`);
      await B.page.getByText('W tej grupie zapraszać mogą tylko właściciel i moderatorzy.').waitFor();
      assert.equal(await B.page.locator('#g-invite').count(), 0, 'zwykły członek nie ma formularza zaproszenia');
      assert.equal(await B.page.getByRole('radiogroup').count(), 0, 'zwykły członek nie zmienia zasady');

      assert.deepEqual(A.problems.left(), []);
      assert.deepEqual(B.problems.left(), []);
    } catch (e) { await shot(A.page, 'grupy-role-ania'); await shot(B.page, 'grupy-role-bartek'); throw e; }
    finally { await A.ctx.close(); await B.ctx.close(); }
  });
