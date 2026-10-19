// Podgląd linków (lib/og.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { SHARES, ogMeta, siteUrl } from '../lib/og.js';

const withEnv = (env, fn) => {
  const keys = ['APP_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL'];
  const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  try { return fn(); } finally { for (const k of keys) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
};

test('adres bazowy: APP_URL, potem produkcja Vercel, nigdy VERCEL_URL ani http poza localhost', () => {
  assert.equal(withEnv({ APP_URL: 'https://zielnik.example/sciezka', VERCEL_PROJECT_PRODUCTION_URL: 'p.vercel.app' }, siteUrl).href, 'https://zielnik.example/');
  assert.equal(withEnv({ VERCEL_PROJECT_PRODUCTION_URL: 'zielnik-seven.vercel.app', VERCEL_URL: 'podglad-abc.vercel.app' }, siteUrl).href, 'https://zielnik-seven.vercel.app/');
  assert.equal(withEnv({ APP_URL: 'http://obcy.example', VERCEL_PROJECT_PRODUCTION_URL: 'p.vercel.app' }, siteUrl).href, 'https://p.vercel.app/');
  assert.equal(withEnv({ APP_URL: 'nie-adres' }, siteUrl).hostname, 'localhost');
  assert.equal(withEnv({ VERCEL_URL: 'podglad-abc.vercel.app' }, siteUrl).hostname, 'localhost');
});

test('każdy podgląd: tytuł, opis, obrazek 1200×630 z public/og, karta summary_large_image', () => {
  for (const kind of Object.keys(SHARES)) {
    const m = ogMeta(kind);
    assert.ok(m.title && m.description.length >= 40 && m.description.length <= 200, kind);
    assert.equal(m.openGraph.locale, 'pl_PL');
    assert.equal(m.openGraph.siteName, 'Zielnik');
    const [img] = m.openGraph.images;
    assert.deepEqual([img.width, img.height], [1200, 630]);
    assert.ok(existsSync(new URL(`../public${img.url}`, import.meta.url)), `brak ${img.url} (node scripts/og-images.mjs)`);
    assert.equal(m.twitter.card, 'summary_large_image');
    assert.deepEqual(m.twitter.images, [img.url]);
    // link trafia do rozmów grupowych: bez słów, które zdradzają rodzaj terapii
    assert.doesNotMatch(JSON.stringify(m), /konop|marihuan|thc|cbd|susz/i, kind);
  }
  assert.equal(ogMeta('nieznany').title, SHARES.app.title);
});
