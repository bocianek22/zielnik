// CSP i ochrona przed CSRF (lib/security-headers.js, używane przez middleware.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp, crossSiteRequest, makeNonce } from '../lib/security-headers.js';

const H = (o) => new Headers(o);

test('CSP: skrypty tylko z nonce, bez unsafe-inline i unsafe-eval w produkcji', () => {
  const csp = buildCsp('abc');
  const dir = Object.fromEntries(csp.split('; ').map((d) => [d.split(' ')[0], d]));
  assert.equal(dir['script-src'], "script-src 'self' 'nonce-abc' 'strict-dynamic'");
  assert.equal(dir['object-src'], "object-src 'none'");
  assert.equal(dir['frame-ancestors'], "frame-ancestors 'none'");
  assert.equal(dir['base-uri'], "base-uri 'self'");
  assert.equal(dir['form-action'], "form-action 'self'");
  assert.ok(dir['upgrade-insecure-requests']);
  assert.ok(!/unsafe-eval/.test(csp));
  assert.ok(!/script-src[^;]*unsafe-inline/.test(csp));
  // podgląd zdjęć (blob:, data:) i service worker muszą działać
  assert.match(dir['img-src'], /data: blob:/);
  assert.equal(dir['worker-src'], "worker-src 'self'");
});

test('CSP w trybie dev: unsafe-eval (React Refresh) i bez upgrade-insecure-requests', () => {
  const csp = buildCsp('n', { dev: true });
  assert.match(csp, /script-src [^;]*'unsafe-eval'/);
  assert.ok(!csp.includes('upgrade-insecure-requests'));
});

test('nonce: losowy, base64, 16 bajtów', () => {
  const a = makeNonce(), b = makeNonce();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9+/]{22}==$/);
});

test('CSRF: metody bezpieczne zawsze przechodzą', () => {
  assert.equal(crossSiteRequest('GET', H({ origin: 'https://zly.example' }), 'zielnik.app'), false);
  assert.equal(crossSiteRequest('HEAD', H({ 'sec-fetch-site': 'cross-site' }), 'zielnik.app'), false);
});

test('CSRF: Origin z innym hostem lub "null" odrzucony, ten sam host przepuszczony', () => {
  assert.equal(crossSiteRequest('POST', H({ origin: 'https://zielnik.app' }), 'zielnik.app'), false);
  assert.equal(crossSiteRequest('DELETE', H({ origin: 'https://ZIELNIK.app' }), 'zielnik.app'), false);
  assert.equal(crossSiteRequest('POST', H({ origin: 'https://zly.example' }), 'zielnik.app'), true);
  assert.equal(crossSiteRequest('PUT', H({ origin: 'https://zielnik.app.zly.example' }), 'zielnik.app'), true);
  assert.equal(crossSiteRequest('PATCH', H({ origin: 'http://zielnik.app:8080' }), 'zielnik.app'), true);
  assert.equal(crossSiteRequest('POST', H({ origin: 'null' }), 'zielnik.app'), true);
  assert.equal(crossSiteRequest('POST', H({ origin: 'nie-adres' }), 'zielnik.app'), true);
});

test('CSRF: bez Origin decyduje Sec-Fetch-Site; brak obu nagłówków przepuszczony (stare klienty)', () => {
  assert.equal(crossSiteRequest('POST', H({ 'sec-fetch-site': 'cross-site' }), 'zielnik.app'), true);
  assert.equal(crossSiteRequest('POST', H({ 'sec-fetch-site': 'same-origin' }), 'zielnik.app'), false);
  assert.equal(crossSiteRequest('POST', H({}), 'zielnik.app'), false);
});
