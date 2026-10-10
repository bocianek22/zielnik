// POM-32: notatka o partii przy zakupie na telefonie (390 px): dodanie w Historii, widoczność w liście zakupów i na karcie odmiany,
// brak widoczności dla innej osoby (bartek, znajomy). Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/partie.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, pool;
before(async () => {
  browser = await launch();
  if (process.env.E2E_DB_URL) pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
});
after(async () => { await browser?.close(); await pool?.end(); });

const serious = async (page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze())
  .violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);

test('partia: dodanie notatki w Historii, widok na liście zakupów i karcie odmiany, niewidoczna dla znajomego',
  { skip: !process.env.E2E_DB_URL && 'brak E2E_DB_URL', timeout: 120000 }, async () => {
    const A = await phone(browser), B = await phone(browser);
    const pa = await A.ctx.newPage(), pb = await B.ctx.newPage();
    try {
      await login(pa, 'ania');
      await go(pa, '/historia');
      const open = pa.getByRole('button', { name: /^Partia:/ }).first();
      await interactive(open);
      await open.click();
      const form = pa.locator('.hist-edit');
      await form.getByLabel(/Numer partii/).fill('E2E-77');
      await form.getByLabel(/Data ważności/).fill('2027-05-20');
      const weaker = form.getByRole('button', { name: 'słabiej' });
      assert.ok((await weaker.boundingBox()).height >= 44, 'przycisk oceny niższy niż 44 px');
      await weaker.click();
      assert.equal(await weaker.getAttribute('aria-pressed'), 'true');
      await form.getByLabel(/Notatka o partii/).fill('Działała słabiej niż poprzednia, mniej aromatu.');
      await form.getByRole('button', { name: 'Zapisz partię' }).click();

      await pa.locator('.hist-msg', { hasText: 'Zapisano notatkę o partii' }).waitFor({ timeout: 15000 });
      const sum = pa.locator('.hist-list .batch-sum', { hasText: 'E2E-77' });
      await sum.waitFor({ timeout: 15000 });
      const text = await sum.innerText();
      assert.match(text, /Partia E2E-77/);
      assert.match(text, /ważna do 20 maja 2027/);
      assert.match(text, /działała: słabiej/);
      assert.match(text, /Działała słabiej niż poprzednia/);
      assert.deepEqual(await serious(pa), []);
      await shot(pa, 'partie-historia');

      // karta odmiany: sekcja „Partie” z tym samym wpisem, edycja w miejscu
      const sid = (await pool.query(`SELECT strain_id FROM purchases WHERE batch_no = 'E2E-77'`)).rows[0].strain_id;
      assert.equal((await pool.query(`SELECT batch_note LIKE 'zenc1:%' AS enc FROM purchases WHERE batch_no = 'E2E-77'`)).rows[0].enc, true, 'notatka zaszyfrowana w bazie');
      await go(pa, `/strains/${sid}`);
      const card = pa.locator('section.strain-batches');
      await card.waitFor();
      assert.match(await card.innerText(), /E2E-77/);
      await card.getByRole('button', { name: /^Edytuj notatkę o partii/ }).first().click();
      await card.getByRole('button', { name: 'jak zwykle' }).click();
      await card.getByRole('button', { name: 'Zapisz partię' }).click();
      await card.locator('.pill', { hasText: 'działała: jak zwykle' }).waitFor({ timeout: 15000 });
      assert.deepEqual(await serious(pa), []);
      await shot(pa, 'partie-odmiana');

      // znajomy (bartek) nie widzi partii ani na karcie odmiany, ani w swojej Historii
      await login(pb, 'bartek');
      await go(pb, `/strains/${sid}`);
      assert.equal(await pb.getByText('E2E-77').count(), 0);
      assert.equal(await pb.locator('section.strain-batches').count(), 0);
      await go(pb, '/historia');
      assert.equal(await pb.getByText('E2E-77').count(), 0);

      assert.deepEqual(A.problems.left(), []);
      assert.deepEqual(B.problems.left(), []);
    } catch (e) { await shot(pa, 'partie-ania'); await shot(pb, 'partie-bartek'); throw e; }
    finally { await A.ctx.close(); await B.ctx.close(); }
  });
