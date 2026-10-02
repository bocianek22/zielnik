// Testy czystej logiki pakowania kopii (gzip + AES-256-GCM): uruchom `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { isEncrypted, packBackup, parseKey, unpackBackup } from '../lib/backup-pack.js';

const JSON_ = JSON.stringify({ users: [{ id: 1, username: 'zażółć gęślą jaźń' }], big: 'x'.repeat(5000) });
const key = () => randomBytes(32).toString('base64');

test('kopia bez klucza: zwykły gzip, round-trip', () => {
  const buf = packBackup(JSON_, '');
  assert.equal(isEncrypted(buf), false);
  assert.equal(gunzipSync(buf).toString('utf8'), JSON_);
  assert.ok(buf.length < JSON_.length);
  assert.equal(unpackBackup(buf), JSON_);
});

test('kopia z kluczem: nagłówek ZBK1 + iv + tag, round-trip, brak jawnego tekstu', () => {
  const k = key();
  const buf = packBackup(JSON_, k);
  assert.equal(isEncrypted(buf), true);
  assert.equal(buf.subarray(0, 4).toString(), 'ZBK1');
  assert.equal(buf.indexOf('gęślą'), -1);
  assert.equal(unpackBackup(buf, k), JSON_);
  // nowy iv przy każdej kopii
  assert.notDeepEqual(packBackup(JSON_, k), buf);
});

test('zły klucz, brak klucza, uszkodzony plik albo zmieniony nagłówek dają błąd', () => {
  const k = key();
  const buf = packBackup(JSON_, k);
  assert.throws(() => unpackBackup(buf, key()), /odszyfrować/);
  assert.throws(() => unpackBackup(buf), /zaszyfrowany/);
  const bad = Buffer.from(buf);
  bad[bad.length - 1] ^= 1;
  assert.throws(() => unpackBackup(bad, k), /odszyfrować/);
  assert.throws(() => unpackBackup(buf.subarray(0, 20), k), /Uszkodzony/);
});

test('klucz musi mieć 32 bajty', () => {
  assert.equal(parseKey(''), null);
  assert.equal(parseKey('  '), null);
  assert.throws(() => parseKey(Buffer.alloc(16).toString('base64')), /32 bajty/);
  assert.throws(() => packBackup(JSON_, 'krotki'), /32 bajty/);
  assert.equal(parseKey(key()).length, 32);
});
