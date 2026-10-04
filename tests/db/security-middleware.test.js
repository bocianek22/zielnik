// middleware.js: CSP z nonce na stronach i odrzucanie żądań API z innej witryny. Bez bazy (tylko loader z next/server).
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware, config } from '../../middleware.js';

const run = (url, init = {}) => middleware(new NextRequest(url, init));

test('strona: CSP z nonce w odpowiedzi i w nagłówkach przekazanych do Next.js', () => {
  const res = run('https://zielnik.app/raport', { headers: { host: 'zielnik.app' } });
  const csp = res.headers.get('content-security-policy');
  const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
  assert.ok(nonce, csp);
  assert.match(csp, /frame-ancestors 'none'/);
  // Next.js dokleja nonce do swoich skryptów tylko, gdy znajdzie CSP w nagłówkach ŻĄDANIA
  assert.equal(res.headers.get('x-middleware-request-x-nonce'), nonce);
  assert.equal(res.headers.get('x-middleware-request-content-security-policy'), csp);
  const other = run('https://zielnik.app/raport', { headers: { host: 'zielnik.app' } });
  assert.notEqual(/'nonce-([^']+)'/.exec(other.headers.get('content-security-policy'))[1], nonce, 'nonce na każde żądanie');
});

test('strona: CSP_REPORT_ONLY=1 przełącza na nagłówek raportujący', () => {
  process.env.CSP_REPORT_ONLY = '1';
  try {
    const res = run('https://zielnik.app/', { headers: { host: 'zielnik.app' } });
    assert.equal(res.headers.get('content-security-policy'), null);
    assert.match(res.headers.get('content-security-policy-report-only'), /'strict-dynamic'/);
  } finally { delete process.env.CSP_REPORT_ONLY; }
});

test('API: POST z innej witryny = 403, z tej samej i GET z innej przechodzą', async () => {
  const evil = run('https://zielnik.app/api/account', { method: 'DELETE', headers: { host: 'zielnik.app', origin: 'https://zly.example' } });
  assert.equal(evil.status, 403);
  assert.match((await evil.json()).error, /innej witryny/);
  const fetchSite = run('https://zielnik.app/api/auth/login', { method: 'POST', headers: { host: 'zielnik.app', 'sec-fetch-site': 'cross-site' } });
  assert.equal(fetchSite.status, 403);
  const ok = run('https://zielnik.app/api/auth/login', { method: 'POST', headers: { host: 'zielnik.app', origin: 'https://zielnik.app' } });
  assert.equal(ok.headers.get('x-middleware-next'), '1');
  const get = run('https://zielnik.app/api/strains', { headers: { host: 'zielnik.app', origin: 'https://zly.example' } });
  assert.equal(get.headers.get('x-middleware-next'), '1');
  assert.equal(get.headers.get('content-security-policy'), null, 'API bez CSP z nonce (ma frame-ancestors z next.config)');
});

test('matcher: pliki statyczne i service worker poza middleware', () => {
  const re = new RegExp(`^${config.matcher[0]}$`);
  for (const p of ['/_next/static/chunks/a.js', '/sw.js', '/offline.html', '/icon-192.png', '/manifest.webmanifest']) assert.ok(!re.test(p), p);
  for (const p of ['/', '/raport', '/api/strains/1/photo', '/u/ewa']) assert.ok(re.test(p), p);
});
