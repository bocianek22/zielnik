// Scenariusze E2E na telefonie (390 px). Uruchomienie: npm run test:e2e (scripts/dev/e2e.sh stawia serwer i dane z seed.mjs).
// Testy idą po kolei na jednej bazie; każdy sam sprząta po sobie (Cofnij, odhaczenie, wyłączenie blokady).
// Każdy test kończy się porażką także wtedy, gdy w konsoli pojawi się błąd, naruszenie CSP albo odpowiedź >= 400.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { launch, phone, login, shot, go, hydrated, interactive } from './helpers.mjs';

let browser;
let session; // storageState konta ania po pierwszym logowaniu (kolejne testy nie obciążają limitu logowań)
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

// Otwiera kontekst telefonu, uruchamia scenariusz i sprawdza brak błędów. Zrzut przy porażce: zrzuty/e2e/<nazwa>.png
async function scenario(name, fn, opts) {
  test(name, async () => {
    const { ctx, problems } = await phone(browser, opts?.());
    const page = await ctx.newPage();
    try {
      await fn(page, ctx, problems);
      assert.deepEqual(problems.left(), [], 'błędy konsoli, CSP lub odpowiedzi >= 400');
    } catch (e) {
      for (const p of ctx.pages()) await shot(p, name);
      throw e;
    } finally { await ctx.close(); }
  });
}
const withSession = () => ({ storageState: session });
const num = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));
const text = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, ' ').trim());

test('logowanie: zły login nie wpuszcza, dobre prowadzi do panelu "Dziś"', async () => {
  const { ctx, problems } = await phone(browser);
  const page = await ctx.newPage();
  try {
    // niezalogowany ląduje na logowaniu
    await go(page, '/');
    await page.waitForURL(/\/login/);
    problems.allow(/401/);
    await page.fill('#u', 'ania');
    await page.fill('#p', 'zle-haslo-123');
    await page.click('button[type=submit]');
    await page.waitForSelector('.alert.error, [role=alert]');
    assert.match(page.url(), /\/login/);
    await login(page, 'ania');
    await page.waitForSelector('.today');
    assert.equal(new URL(page.url()).pathname, '/');
    assert.match(await text(page.locator('.today')), /Zapas suszu/);
    session = await ctx.storageState();
    assert.deepEqual(problems.left(), []);
  } catch (e) { await shot(page, 'logowanie'); throw e; } finally { await ctx.close(); }
});

scenario('"Zużyłem" i "Cofnij" w panelu "Dziś"', async (page) => {
  await go(page, '/');
  const quick = page.locator('.today-quick');
  const stock = async () => num((await text(quick.locator('.tq-stock'))).match(/mam ([\d,]+)/)[1]);
  const before = await stock();
  await quick.locator('.quick-btn').first().click();
  await quick.locator('.use-chip', { hasText: '0,25' }).click();
  await quick.getByRole('button', { name: 'Zapisz zużycie' }).click();
  await quick.locator('.quick-msg', { hasText: 'Zapisano' }).waitFor();
  assert.ok(Math.abs((await stock()) - (before - 0.25)) < 1e-6, 'stan spada o 0,25');
  await quick.getByRole('button', { name: 'Cofnij' }).click();
  await page.waitForFunction(() => !document.querySelector('.today-quick .undo-btn'));
  assert.ok(Math.abs((await stock()) - before) < 1e-6, 'po cofnięciu stan wraca');
}, withSession);

scenario('Wykres zużycia 14 dni: strzałki zmieniają odczyt, Escape wraca do dziś; prognoza zapasu ma podpis o tempie zapisów', async (page) => {
  await go(page, '/');
  const read = page.locator('.usage-sel');
  assert.match(await text(read), /^Dziś/);
  await page.locator('.usage-scrub').focus();
  await page.keyboard.press('ArrowLeft');
  assert.match(await text(read), /^Wczoraj/, 'strzałka w lewo wybiera wczoraj');
  await page.keyboard.press('Home');
  assert.doesNotMatch(await text(read), /^(Dziś|Wczoraj)/, 'Home wybiera pierwszy dzień');
  await page.keyboard.press('Escape');
  assert.match(await text(read), /^Dziś/);
  // przy dwóch jednostkach prognozy są w zwijanym wierszu „Prognoza i wykupy”
  const notes = page.locator('details.stock-notes');
  if (await notes.count()) await notes.locator('summary').click();
  assert.match(await text(page.locator('.fc-note').first()), /Przy obecnym tempie zapisów/);
}, withSession);

scenario('"Wykupiłem" na karcie odmiany (i Cofnij)', async (page) => {
  await go(page, '/');
  const btn = page.getByRole('button', { name: 'Wykupiłem: Lemon Skunk' });
  const card = page.locator('.quick').filter({ has: btn });
  await btn.click();
  await card.getByRole('textbox').fill('1');
  await card.getByRole('button', { name: 'Zapisz wykup' }).click();
  const msg = card.locator('.quick-msg', { hasText: 'Zapisano: +1 g' });
  await msg.waitFor();
  await card.getByRole('button', { name: 'Cofnij' }).click();
  await page.waitForFunction(() => !document.querySelector('.undo-btn'));
  assert.match(await text(card.locator('.quick-stock')), /Mam 6,5 g, do wykupienia 10 g/, 'po cofnięciu stan jak przed wykupem');
}, withSession);

scenario('szybki wpis objawów, także własny objaw', async (page) => {
  // własny objaw w Dzienniku
  await go(page, '/dziennik');
  const det = page.locator('.sym-custom');
  if (!(await det.evaluate((d) => d.open))) await det.locator('summary').click();
  await page.fill('#cn-name', 'Nudności E2E');
  await page.getByRole('button', { name: 'Dodaj objaw' }).click();
  await page.getByText('Dodano własny objaw.').waitFor();

  await go(page, '/');
  const sym = page.locator('#objawy');
  // sekcja hydratuje się osobno od reszty strony: klik w "Zmień" ponawiamy, aż panel się rozwinie
  for (let i = 0; i < 10 && !(await sym.getByRole('button', { name: /^Ból: 5 z 10/ }).isVisible()); i++) {
    if (await sym.getByRole('button', { name: 'Zmień' }).count()) await sym.getByRole('button', { name: 'Zmień' }).click();
    await page.waitForTimeout(300);
  }
  await sym.getByRole('button', { name: /^Ból: 5 z 10/ }).click();
  await sym.locator('[role=status]', { hasText: 'Zapisano' }).waitFor();
  await sym.getByRole('button', { name: /^Nudności E2E: 7 z 10/ }).click();
  await page.waitForFunction(() => /Zapisano/.test(document.querySelector('#objawy [role=status]')?.textContent || ''));
  await page.reload({ waitUntil: 'load' });
  await hydrated(page);
  const after = await text(page.locator('#objawy'));
  assert.match(after, /ból 5/);
  assert.match(after, /nudności e2e 7/);

  // sprzątanie: usunięcie własnego objawu razem z wpisami
  await go(page, '/dziennik');
  page.once('dialog', (d) => d.accept());
  await page.locator('.sym-custom').getByRole('button', { name: /Usuń/ }).first().click();
  await page.getByText('Usunięto własny objaw i jego wpisy.').waitFor();
}, withSession);

scenario('"Dziś bez zużycia" i "Cofnij"', async (page) => {
  // bartek nie ma dziś zużycia (ania ma je w danych z seeda), więc znacznik jest dostępny
  await login(page, 'bartek');
  await go(page, '/');
  await page.getByRole('button', { name: 'Dziś bez zużycia' }).click();
  await page.getByText('Dziś oznaczone jako dzień bez zużycia.').waitFor();
  await page.reload({ waitUntil: 'load' });
  await hydrated(page);
  await page.getByText('Dziś oznaczone jako dzień bez zużycia.').waitFor();
  await page.locator('.no-use').getByRole('button', { name: 'Cofnij' }).click();
  await page.getByRole('button', { name: 'Dziś bez zużycia' }).waitFor();
});

scenario('Recepty: "W aptece" i "Wykupiłem" zmniejsza resztę na recepcie', async (page) => {
  await go(page, '/recepty');
  const card = page.locator('.pharmacy');
  const left = async () => num((await text(card.locator('.pharmacy-rx li', { hasText: ' g zostało' }).first())).match(/([\d,]+) g zostało/)[1]);
  const before = await left();
  const pool = card.locator('.pharmacy-pool').filter({ hasText: 'do wykupienia' }).filter({ hasText: / g do wykupienia/ }).first();
  await pool.getByRole('button', { name: /^Wykupiłem/ }).click();
  await pool.getByRole('textbox').fill('1');
  await pool.getByRole('button', { name: 'Zapisz wykup' }).click();
  await pool.locator('.quick-msg', { hasText: 'Zapisano: +1 g' }).waitFor();
  await page.waitForFunction((b) => {
    const m = [...document.querySelectorAll('.pharmacy-rx li')].map((e) => e.textContent.match(/([\d,]+) g zostało/)).find(Boolean);
    return m && Number(m[1].replace(',', '.')) === b - 1;
  }, before);
  assert.equal(await left(), before - 1);
  await pool.getByRole('button', { name: 'Cofnij' }).click();
  await page.waitForFunction((b) => {
    const m = [...document.querySelectorAll('.pharmacy-rx li')].map((e) => e.textContent.match(/([\d,]+) g zostało/)).find(Boolean);
    return m && Number(m[1].replace(',', '.')) === b;
  }, before);
}, withSession);

scenario('Raport: "Do omówienia z lekarzem" (dodaj, arkusz, odhacz)', async (page) => {
  await go(page, '/raport');
  const notes = page.locator('.doctor-notes');
  await page.fill('#dn-new', 'Zapytać o przedłużenie recepty');
  await notes.getByRole('button', { name: 'Dodaj' }).click();
  await notes.locator('.dn-list').getByText('Zapytać o przedłużenie recepty').waitFor();
  const sheet = page.locator('.report-notes');
  await sheet.getByText('Zapytać o przedłużenie recepty').waitFor();
  await notes.getByRole('checkbox', { name: /Omówione: Zapytać o przedłużenie recepty/ }).click();
  await page.waitForFunction(() => !document.querySelector('.report-notes')?.textContent.includes('Zapytać o przedłużenie recepty'));
  // sprzątanie: usunięcie omówionego punktu
  await notes.locator('summary').click();
  page.once('dialog', (d) => d.accept());
  await notes.locator('.dn-done').getByRole('button', { name: /Usuń/ }).click();
  await page.waitForFunction(() => !document.querySelector('.doctor-notes .dn-done'));
}, withSession);

scenario('Profil: blokada PIN (włącz, nowa karta blokuje, odblokuj, zmień PIN, wyłącz)', async (page, ctx, problems) => {
  problems.allow(/40[01]/); // zły PIN w „Zmień PIN” kończy się odpowiedzią 4xx z komunikatem
  await go(page, '/profil');
  const setup = page.locator('.lock-setup');
  await setup.getByRole('switch').first().click();
  await page.fill('#wl-pin', '1234');
  await page.fill('#wl-pin2', '1234');
  await setup.getByRole('button', { name: 'Włącz blokadę' }).click();
  await setup.getByRole('button', { name: 'Zmień PIN' }).waitFor();

  // nowa karta jest zablokowana; zły PIN nie odblokowuje, dobry tak
  const p2 = await ctx.newPage();
  await go(p2, '/');
  await p2.waitForSelector('input[type=password]');
  await p2.fill('input[type=password]', '0000');
  await p2.keyboard.press('Enter');
  await p2.getByText('Niepoprawny PIN.').waitFor();
  await p2.fill('input[type=password]', '1234');
  await p2.keyboard.press('Enter');
  await p2.waitForFunction(() => !document.documentElement.dataset.applock && !document.querySelector('input[type=password]'), null, { timeout: 8000 });
  await p2.close();

  // zmiana PIN-u
  await setup.getByRole('button', { name: 'Zmień PIN' }).click();
  await page.fill('#wl-cur', '9999');
  await page.fill('#wl-new', '5678');
  await page.fill('#wl-new2', '5678');
  await setup.locator('form button', { hasText: 'Zmień PIN' }).click();
  await page.locator('.alert.error').first().waitFor();
  await page.fill('#wl-cur', '1234');
  await setup.locator('form button', { hasText: 'Zmień PIN' }).click();
  await page.getByText('PIN zmieniony.').waitFor();

  // nowy PIN odblokowuje kolejną kartę
  const p3 = await ctx.newPage();
  await go(p3, '/');
  await p3.waitForSelector('input[type=password]');
  await p3.fill('input[type=password]', '5678');
  await p3.keyboard.press('Enter');
  await p3.waitForFunction(() => !document.documentElement.dataset.applock && !document.querySelector('input[type=password]'), null, { timeout: 8000 });
  await p3.close();

  // sprzątanie: wyłączenie blokady
  await page.reload({ waitUntil: 'load' });
  await hydrated(page);
  const lock = page.locator('.lock-setup');
  await lock.getByRole('switch').first().click();
  await page.fill('#wl-off', '5678');
  await lock.getByRole('button', { name: 'Wyłącz blokadę' }).click();
  await page.waitForFunction(() => !document.querySelector('.lock-setup input[role=switch]')?.checked && !document.querySelector('#wl-off'));
}, withSession);

scenario('Profil: przypomnienia (wyłączone domyślnie, wieczorne zablokowane bez crona co godzinę, data wizyty zapisuje się)', async (page) => {
  await go(page, '/profil');
  const sec = page.locator('section[aria-labelledby=remind-h]');
  await sec.getByRole('switch').first().waitFor();
  await sec.getByText(/nie są jeszcze włączone na serwerze/).waitFor(); // serwer testowy nie ma kluczy push
  const [sym, visit] = [sec.getByRole('switch').nth(0), sec.getByRole('switch').nth(1)];
  assert.equal(await sym.isChecked(), false);
  assert.equal(await visit.isChecked(), false);
  assert.equal(await sec.locator('#remind-hour').isDisabled(), true);
  assert.equal(await sec.locator('#remind-visit').isDisabled(), true);
  // serwer testowy nie ma PUSH_CRON_HOURLY: wieczorne przypomnienie nie do włączenia, z wyjaśnieniem
  assert.equal(await sym.isDisabled(), true);
  await sec.getByText(/Wymaga planu z przypomnieniami co godzinę/).waitFor();

  await visit.click();
  const date = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await sec.locator('#remind-visit').fill(date);
  await page.waitForFunction((d) => document.querySelector('#remind-visit').value === d, date);

  // po odświeżeniu ustawienia są zapamiętane na koncie
  await page.reload({ waitUntil: 'load' });
  await hydrated(page);
  await sec.getByRole('switch').first().waitFor();
  await page.waitForFunction((d) => document.querySelector('#remind-visit')?.value === d, date);
  assert.equal(await sec.getByRole('switch').nth(1).isChecked(), true);

  // sprzątanie: usunięcie daty i wyłączenie
  await sec.locator('#remind-visit').fill('');
  await sec.getByRole('switch').nth(1).click();
  await page.waitForFunction(() => !document.querySelectorAll('section[aria-labelledby=remind-h] input[role=switch]')[1]?.checked);
  await sec.getByText('Zapisano.').waitFor();
}, withSession);

scenario('tryb dyskretny: nazwy rozmyte, tytuł "Notatnik"',async (page) => {
  await go(page, '/profil');
  await page.getByRole('switch', { name: 'Tryb dyskretny' }).check();
  await page.waitForFunction(() => document.title === 'Notatnik' || document.documentElement.hasAttribute('data-discreet'));
  await go(page, '/');
  await page.waitForSelector('.dn');
  const blurs = await page.$$eval('.dn', (els) => els.map((e) => getComputedStyle(e).filter));
  assert.ok(blurs.length > 0 && blurs.every((f) => /blur/.test(f)), `nazwy rozmyte: ${blurs.slice(0, 3)}`);
  assert.equal(await page.title(), 'Notatnik');
  // dotknięcie odsłania nazwę na chwilę
  await page.locator('.dn').first().tap();
  await page.waitForFunction(() => !/blur/.test(getComputedStyle(document.querySelector('.dn')).filter), null, { timeout: 3000 });
  // wyłączenie przywraca widok
  await go(page, '/profil');
  await page.getByRole('switch', { name: 'Tryb dyskretny' }).uncheck();
  await go(page, '/');
  await page.waitForSelector('.dn');
  assert.ok((await page.$$eval('.dn', (els) => els.map((e) => getComputedStyle(e).filter))).every((f) => !/blur/.test(f)));
}, withSession);

scenario('KAT-1: edycja cudzej odmiany to propozycja; admin ją odrzuca z powodem, autor widzi status', async (page, ctx, problems) => {
  await login(page, 'bartek');
  const id = await page.evaluate(async () => (await (await fetch('/api/strains?limit=100')).json()).strains.find((x) => x.name === 'Lemon Skunk').id);
  await go(page, `/strains/${id}`);
  const edit = page.getByRole('button', { name: 'Edytuj odmianę' });
  await interactive(edit);
  await edit.click();
  await page.getByText('Twoja zmiana trafi do akceptacji').waitFor();
  await page.locator(`#s${id}-taste`).fill('propozycja e2e');
  await page.getByRole('button', { name: 'Wyślij', exact: true }).click();
  await page.getByText('Propozycja wysłana').waitFor();
  await page.getByRole('button', { name: 'Zamknij' }).click();
  await page.getByRole('heading', { name: 'Twoja propozycja czeka' }).waitFor();
  assert.ok(!(await text(page.locator('main'))).includes('propozycja e2e') || (await text(page.locator('.proposal-box'))).includes('propozycja e2e'), 'odmiana bez zmian do decyzji admina');
  // admin: zakładka „Propozycje”, różnica pole po polu, odrzucenie z powodem
  const admin = await phone(browser);
  const ap = await admin.ctx.newPage();
  try {
    await login(ap, 'Bocian');
    await go(ap, '/admin');
    const tab = ap.getByRole('tab', { name: /Propozycje/ });
    await interactive(tab);
    await tab.click();
    const item = ap.locator('.proposal-item', { hasText: 'Lemon Skunk' });
    await item.getByText('propozycja e2e').waitFor();
    await item.getByRole('button', { name: 'Odrzuć…' }).click();
    await item.getByLabel(/Powód odrzucenia/).fill('Smak do sprawdzenia');
    await item.getByRole('button', { name: 'Odrzuć', exact: true }).click();
    await ap.locator('.proposal-item', { hasText: 'Lemon Skunk' }).waitFor({ state: 'detached' });
    assert.deepEqual(admin.problems.left(), []);
  } finally { await admin.ctx.close(); }
  await page.reload();
  await page.getByRole('heading', { name: 'Twoja propozycja została odrzucona' }).waitFor();
  assert.match(await text(page.locator('.proposal-box')), /Smak do sprawdzenia/);
  assert.deepEqual(problems.left(), []);
});

scenario('wylogowanie', async (page) => {
  await login(page, 'ania');
  await go(page, '/');
  await page.getByRole('button', { name: 'Więcej' }).click();
  await page.locator('.logout, button:has-text("Wyloguj")').filter({ visible: true }).first().click();
  await page.waitForURL(/\/login/);
  await go(page, '/');
  await page.waitForURL(/\/login/);
});
