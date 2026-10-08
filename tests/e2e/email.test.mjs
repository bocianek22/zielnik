// KON-1 w przeglądarce: dodanie adresu w profilu, potwierdzenie z linku, „Nie pamiętam hasła” i nowe hasło.
// Wysyłkę przejmuje atrapa API Resend na E2E_MAIL_PORT (scripts/dev/e2e.sh ustawia MAIL_API_URL na 127.0.0.1).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { BASE, launch, phone, shot, go } from './helpers.mjs';

const PORT = Number(process.env.E2E_MAIL_PORT);
const skip = PORT ? false : 'brak E2E_MAIL_PORT (uruchom przez npm run test:e2e)';
let browser, server;
const inbox = [];

before(async () => {
  if (skip) return;
  browser = await launch();
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { inbox.push({ auth: req.headers.authorization, ...JSON.parse(body) }); } catch { /* pomijamy */ }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('{"id":"e2e"}');
    });
  });
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
});
after(async () => { await browser?.close(); await new Promise((r) => (server ? server.close(r) : r())); });

async function waitMail(to, re) {
  for (let i = 0; i < 100; i++) {
    const m = inbox.find((x) => x.to?.[0] === to && re.test(x.subject));
    if (m) { inbox.splice(inbox.indexOf(m), 1); return m; }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`brak maila do ${to} (${re})`);
}
const linkOf = (m) => m.text.match(/http:\/\/\S+#t=[A-Za-z0-9_-]{43}/)[0];

test('e-mail: dodanie i potwierdzenie adresu, reset hasła z linku, logowanie nowym hasłem', { skip }, async () => {
  const { ctx, problems } = await phone(browser);
  const page = await ctx.newPage();
  const user = `ewa${Date.now() % 100000}`;
  const addr = `${user}@example.test`;
  try {
    const reg = await page.request.post(`${BASE}/api/auth/register`, { data: { invite: 'DEV1', username: user, password: 'stare-haslo-1', adult: true, consent: true } });
    assert.equal(reg.status(), 200);
    await go(page, '/profil');
    await page.getByRole('button', { name: 'Dodaj adres' }).click();
    await page.fill('#em-addr', addr);
    await page.getByLabel(/Zgadzam się na zapisanie adresu/).check();
    await page.fill('#em-pw', 'stare-haslo-1');
    await page.getByRole('button', { name: 'Zapisz i wyślij link' }).click();
    await page.getByText(/Wysłaliśmy link potwierdzający/).waitFor();
    const verify = await waitMail(addr, /potwierdź adres/);
    assert.equal(verify.auth, 'Bearer e2e');
    assert.equal(/konop/i.test(verify.text + verify.html), false);
    await go(page, new URL(linkOf(verify)).pathname + new URL(linkOf(verify)).hash);
    assert.equal(new URL(page.url()).hash, '', 'token usunięty z paska adresu');
    await page.getByRole('button', { name: 'Potwierdź adres' }).click();
    await page.getByText('Adres potwierdzony').waitFor();
    await go(page, '/profil');
    await page.locator('.badge', { hasText: 'potwierdzony' }).waitFor();

    // wylogowany: „Nie pamiętam hasła” na stronie logowania
    await ctx.clearCookies();
    await go(page, '/login');
    await page.getByRole('link', { name: 'Nie pamiętam hasła' }).click();
    await page.waitForURL(/\/odzyskaj-haslo/);
    await page.fill('#f-login', addr);
    await page.getByRole('button', { name: 'Wyślij link' }).click();
    await page.getByText(/Jeśli konto ma potwierdzony adres/).waitFor();
    const reset = await waitMail(addr, /nowego hasła/);
    assert.ok(reset.text.includes(`„${user}”`));
    const link = new URL(linkOf(reset));
    await go(page, link.pathname + link.hash);
    await page.fill('#n', 'nowe-haslo-1');
    await page.fill('#r', 'nowe-haslo-1');
    await page.getByRole('button', { name: 'Zapisz hasło' }).click();
    await page.getByText('Hasło zmienione').waitFor();
    await page.getByRole('link', { name: 'Zaloguj się' }).click();
    await page.waitForURL(/\/login/);
    await page.fill('#u', user);
    await page.fill('#p', 'nowe-haslo-1');
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), page.click('button[type=submit]')]);
    assert.deepEqual(problems.left(), [], 'błędy konsoli, CSP lub odpowiedzi >= 400');
  } catch (e) {
    await shot(page, 'email-reset');
    throw e;
  } finally {
    await ctx.close();
  }
});
