// „Co nowego” (lib/whats-new.js) i link do grupy testerów (lib/beta.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WHATS_NEW, compareVersions, newerThan } from '../lib/whats-new.js';
import { betaGroupUrl } from '../lib/beta.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

test('lista „Co nowego” ma wpis dla bieżącej wersji z package.json', () => {
  assert.ok(WHATS_NEW.some((e) => e.version === VERSION), `dopisz wpis dla ${VERSION} w lib/whats-new.js`);
});

test('wpisy: najnowsze pierwsze, niepuste, bez słów zdradzających temat aplikacji', () => {
  for (let i = 1; i < WHATS_NEW.length; i++) assert.equal(compareVersions(WHATS_NEW[i - 1].version, WHATS_NEW[i].version), 1);
  for (const e of WHATS_NEW) {
    assert.ok(e.items.length > 0);
    for (const t of e.items) assert.doesNotMatch(t, /konopi|zielnik|thc|cbd/i, t);
  }
});

test('compareVersions porównuje liczbowo; newerThan zwraca tylko nowsze i nie nowsze od bieżącej', () => {
  assert.equal(compareVersions('0.9.0', '0.10.0'), -1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.deepEqual(newerThan('0.46.0', '0.48.0').map((e) => e.version), ['0.48.0', '0.47.0']);
  assert.deepEqual(newerThan('0.48.0', '0.48.0'), []);
  assert.deepEqual(newerThan('0.47.0', '0.47.0'), []);
});

test('BETA_GROUP_URL: tylko https, bez danych logowania; inaczej ukryty', () => {
  const was = process.env.BETA_GROUP_URL;
  try {
    for (const bad of [undefined, '', 'http://chat.example.com/x', 'javascript:alert(1)', 'https://u:p@chat.example.com/', 'nie adres', 'https://localhost/x']) {
      if (bad === undefined) delete process.env.BETA_GROUP_URL; else process.env.BETA_GROUP_URL = bad;
      assert.equal(betaGroupUrl(), null, String(bad));
    }
    process.env.BETA_GROUP_URL = ' https://chat.example.com/invite/abc ';
    assert.equal(betaGroupUrl(), 'https://chat.example.com/invite/abc');
  } finally {
    if (was === undefined) delete process.env.BETA_GROUP_URL; else process.env.BETA_GROUP_URL = was;
  }
});
