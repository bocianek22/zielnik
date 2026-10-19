// „Cofnij” po usunięciu (useUndoDelete): recepta, wpis dnia w dzienniku i punkt „Do omówienia”. Usunięcie trafia do bazy
// od razu (bez okna potwierdzenia), „Cofnij” odtwarza wpis. Konto bartek (dane tworzone w teście), żeby nie zmieniać
// danych Ani z seed.mjs. Uruchomienie: npm run test:e2e (E2E_FILES=tests/e2e/cofnij.test.mjs).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser, ctx, page, pool;
before(async () => {
  browser = await launch();
  ({ ctx } = await phone(browser));
  page = await ctx.newPage();
  await login(page, 'bartek');
  pool = new pg.Pool({ connectionString: process.env.E2E_DB_URL });
});
after(async () => { await pool?.end(); await ctx?.close(); await browser?.close(); });

const call = (url, method, body) => page.evaluate(([u, m, b]) => fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.status), [url, method, body]);
const count = async (sql, params) => (await pool.query(sql, params)).rows[0].n;
// stan bazy zmienia się po odpowiedzi serwera: krótkie czekanie zamiast stałego opóźnienia
async function until(sql, params, want) {
  for (let i = 0; i < 40; i++) { if (await count(sql, params) === want) return; await page.waitForTimeout(100); }
  assert.equal(await count(sql, params), want, sql);
}
const status = (t) => page.getByRole('status').filter({ hasText: t }).waitFor();

test('Recepta: usunięcie od razu w bazie, „Cofnij” odtwarza receptę z notatką', async () => {
  try {
    assert.equal(await call('/api/prescriptions', 'POST', { issuedOn: '2026-09-01', validUntil: '2027-03-01', grams: 15, unit: 'g', note: 'e2e cofnij' }), 200);
    const Q = `SELECT count(*)::int AS n FROM prescriptions p JOIN users u ON u.id = p.user_id WHERE u.username = 'bartek' AND p.grams = 15`;
    await go(page, '/recepty');
    const del = page.locator('.rx-row').filter({ hasText: 'e2e cofnij' }).getByRole('button', { name: /^Usuń receptę/ });
    await interactive(del);
    await del.click(); // bez okna potwierdzenia
    await status('Usunięto receptę.');
    await until(Q, [], 0);
    await page.getByRole('button', { name: 'Cofnij' }).click();
    await page.locator('.rx-row').filter({ hasText: 'e2e cofnij' }).waitFor();
    await until(Q, [], 1);
    assert.equal(await page.getByRole('button', { name: 'Cofnij' }).count(), 0);
  } catch (e) { await shot(page, 'cofnij-recepta'); throw e; }
});

test('Dziennik: usunięcie wpisu dnia i „Cofnij” z tymi samymi wartościami', async () => {
  try {
    const day = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date()));
    assert.equal(await call('/api/symptoms', 'PUT', { day, pain: 4, mood: 6, note: 'notatka e2e' }), 200);
    const Q = `SELECT count(*)::int AS n FROM symptom_log s JOIN users u ON u.id = s.user_id WHERE u.username = 'bartek' AND s.day = $1 AND s.pain = 4 AND s.mood = 6 AND s.note <> ''`;
    await go(page, '/dziennik');
    const edit = page.locator('.sym-today').getByRole('button', { name: 'Zmień' });
    await interactive(edit);
    await edit.click();
    await page.getByRole('button', { name: 'Usuń wpis' }).click();
    await status('Usunięto wpis z tego dnia.');
    await until(Q, [day], 0);
    assert.equal(await page.locator('.sym-today').count(), 0);
    await page.getByRole('button', { name: 'Cofnij' }).click();
    await page.locator('.sym-today').waitFor();
    await until(Q, [day], 1);
    // sprzątanie
    assert.equal(await call('/api/symptoms', 'DELETE', { day }), 200);
  } catch (e) { await shot(page, 'cofnij-dziennik'); throw e; }
});

test('Do omówienia: punkt usunięty od razu i przywrócony po „Cofnij”', async () => {
  try {
    assert.equal(await call('/api/doctor-notes', 'POST', { text: 'Punkt e2e do cofnięcia' }), 200);
    // treść w bazie jest szyfrowana (1.1.0), więc liczymy punkty konta zamiast szukać tekstu
    const Q = `SELECT count(*)::int AS n FROM doctor_notes d JOIN users u ON u.id = d.user_id WHERE u.username = 'bartek'`;
    const n0 = await count(Q, []);
    await go(page, '/raport');
    const item = page.locator('.dn-list li', { hasText: 'Punkt e2e do cofnięcia' });
    await item.waitFor({ timeout: 15000 });
    const del = item.getByRole('button', { name: 'Usuń' });
    await interactive(del);
    await del.click();
    await status('Usunięto punkt.');
    await until(Q, [], n0 - 1);
    assert.equal(await item.count(), 0);
    await page.getByRole('button', { name: 'Cofnij' }).click();
    await item.waitFor();
    await until(Q, [], n0);
    // sprzątanie
    await item.getByRole('button', { name: 'Usuń' }).click();
    await until(Q, [], n0 - 1);
  } catch (e) { await shot(page, 'cofnij-omowienie'); throw e; }
});
