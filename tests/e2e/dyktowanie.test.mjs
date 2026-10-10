// Dyktowanie notatek (POM-43): przycisk „Dyktuj” przy notatce dnia i „Do omówienia”; atrapa SpeechRecognition emituje wynik,
// informacja o prywatności przy pierwszym użyciu, błąd zgody na mikrofon, brak przycisku bez API i w aplikacji Android.
// Uruchomienie: npm run test:e2e.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { launch, phone, login, shot, go, interactive } from './helpers.mjs';

let browser;
before(async () => { browser = await launch(); });
after(async () => { await browser?.close(); });

// Atrapa: start() zgłasza wynik wstępny, ostateczny i koniec (albo błąd z window.__sr.error); ustawienia sesji trafiają do window.__sr
const mockSpeech = ({ error, noApi, native }) => {
  window.__sr = { starts: 0, lang: null, interim: null };
  if (native) {
    Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14) ZielnikApp/0.5.0' });
    window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
  }
  if (noApi) { window.SpeechRecognition = undefined; window.webkitSpeechRecognition = undefined; return; }
  const res = (t, isFinal) => Object.assign([{ transcript: t }], { isFinal });
  class Fake {
    start() {
      window.__sr.starts++; window.__sr.lang = this.lang; window.__sr.interim = this.interimResults;
      setTimeout(() => {
        if (error) { this.onerror?.({ error }); this.onend?.(); return; }
        this.onresult?.({ resultIndex: 0, results: [res('boli mnie', false)] });
        setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [res('boli mnie głowa', true)] }); this.onend?.(); }, 150);
      }, 100);
    }
    stop() { this.onend?.(); }
    abort() {}
  }
  window.SpeechRecognition = Fake;
};

async function open(opts, path = '/raport') {
  const { ctx } = await phone(browser);
  await ctx.addInitScript(mockSpeech, opts);
  const page = await ctx.newPage();
  await login(page);
  await go(page, path);
  return { ctx, page };
}

test('Dyktowanie: „Do omówienia” – informacja przy pierwszym użyciu, potem tekst trafia do pola (lang pl-PL, wyniki wstępne)', async () => {
  const { ctx, page } = await open({});
  try {
    const btn = page.getByRole('button', { name: 'Dyktuj' });
    await btn.waitFor({ timeout: 15000 });
    assert.ok((await btn.boundingBox()).height >= 44, 'przycisk niższy niż 44 px');
    assert.equal(await btn.getAttribute('aria-pressed'), 'false');
    const input = page.locator('#dn-new');
    await input.fill('Zapytać:');
    await btn.click();
    // pierwsze użycie: informacja zamiast nasłuchu
    await page.getByText(/Rozpoznawanie mowy wykonuje przeglądarka/).waitFor();
    assert.equal(await page.evaluate(() => window.__sr.starts), 0);
    await page.getByRole('button', { name: 'Rozumiem, dyktuj' }).click();
    await page.waitForFunction(() => window.__sr.starts === 1);
    await page.waitForFunction(() => document.querySelector('#dn-new').value === 'Zapytać: boli mnie głowa', null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => [window.__sr.lang, window.__sr.interim]), ['pl-PL', true]);
    await page.getByRole('button', { name: 'Dyktuj' }).waitFor(); // sesja skończona
    assert.equal(await page.evaluate(() => localStorage.getItem('zielnik.dictate.notice')), '1');
    // kolejne użycie bez informacji, tekst dopisuje się do poprzedniego
    await page.getByRole('button', { name: 'Dyktuj' }).click();
    await page.waitForFunction(() => window.__sr.starts === 2);
    await page.waitForFunction(() => document.querySelector('#dn-new').value === 'Zapytać: boli mnie głowa boli mnie głowa', null, { timeout: 5000 });
    assert.equal(await page.getByText(/Rozpoznawanie mowy wykonuje przeglądarka/).count(), 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 0, 'poziome przewijanie');
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    assert.deepEqual(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => v.id), []);
  } catch (e) { await shot(page, 'dyktowanie-raport'); throw e; } finally { await ctx.close(); }
});

test('Dyktowanie: notatka dnia w dzienniku objawów', async () => {
  const { ctx, page } = await open({}, '/dziennik');
  try {
    await page.evaluate(() => localStorage.setItem('zielnik.dictate.notice', '1'));
    const note = page.locator('#sy-note');
    const change = page.getByRole('button', { name: 'Zmień', exact: true });
    // dane startowe (ania ma wpis z dziś) ładują się po hydratacji: formularz najpierw bywa widoczny, potem zwija się do podsumowania
    await change.waitFor({ timeout: 15000 });
    await interactive(change);
    await change.click();
    await note.waitFor({ timeout: 10000 });
    await note.fill('Wieczór:');
    await page.locator('#sy-note').locator('xpath=..').getByRole('button', { name: 'Dyktuj' }).click();
    await page.waitForFunction(() => document.querySelector('#sy-note').value === 'Wieczór: boli mnie głowa', null, { timeout: 5000 });
  } catch (e) { await shot(page, 'dyktowanie-dziennik'); throw e; } finally { await ctx.close(); }
});

test('Dyktowanie: odmowa mikrofonu daje czytelny komunikat, pole bez zmian', async () => {
  const { ctx, page } = await open({ error: 'not-allowed' });
  try {
    await page.evaluate(() => localStorage.setItem('zielnik.dictate.notice', '1'));
    await page.locator('#dn-new').fill('Test');
    await page.getByRole('button', { name: 'Dyktuj' }).click();
    const alert = page.getByRole('alert').filter({ hasText: 'mikrofon' });
    await alert.waitFor({ timeout: 5000 });
    assert.match(await alert.innerText(), /Brak zgody na użycie mikrofonu/);
    assert.equal(await page.locator('#dn-new').inputValue(), 'Test');
  } catch (e) { await shot(page, 'dyktowanie-blad'); throw e; } finally { await ctx.close(); }
});

test('Dyktowanie: bez SpeechRecognition i w aplikacji Android nie ma przycisku', async () => {
  for (const opts of [{ noApi: true }, { native: true }]) {
    const { ctx, page } = await open(opts);
    try {
      await page.locator('#dn-new').waitFor({ timeout: 15000 });
      await page.waitForTimeout(500); // po zamontowaniu
      assert.equal(await page.getByRole('button', { name: /Dyktuj|Słucham/ }).count(), 0, JSON.stringify(opts));
    } catch (e) { await shot(page, 'dyktowanie-brak'); throw e; } finally { await ctx.close(); }
  }
});
