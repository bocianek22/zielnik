// Rozpoznanie aplikacji natywnej po user agencie (lib/client.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativeApp } from '../lib/client.js';

const CHROME = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36';

test('isNativeApp: tylko user agent z ZielnikApp/<wersja>', () => {
  assert.equal(isNativeApp(new Headers({ 'user-agent': `${CHROME} ZielnikApp/0.1.0` })), true);
  assert.equal(isNativeApp(new Headers({ 'user-agent': `${CHROME} ZielnikApp/1 ZielnikPush/fcm` })), true);
  assert.equal(isNativeApp({ 'user-agent': 'Mozilla/5.0 (iPhone) ZielnikApp/2.3' }), true);
  assert.equal(isNativeApp(new Headers({ 'user-agent': CHROME })), false);
  assert.equal(isNativeApp(new Headers({ 'user-agent': `${CHROME} NieZielnikApp/1` })), false);
  assert.equal(isNativeApp(new Headers({ 'user-agent': 'ZielnikApp/' })), false);
  assert.equal(isNativeApp(new Headers()), false);
  assert.equal(isNativeApp(null), false);
});
