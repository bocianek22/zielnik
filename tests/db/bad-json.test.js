// Zepsuty JSON w treści żądania: 400 zamiast 500 (TypeError przy destrukturyzacji, wpis w dzienniku błędów).
// Przegląd wszystkich tras zapisu w app/api + logowanie (limit liczony przed parsowaniem).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { setup, skip } from './harness.mjs';

let h;
before(async () => {
  if (skip) return;
  h = await setup(['ania']);
  await h.q`UPDATE users SET is_admin = TRUE WHERE id = ${h.ids.ania}`;
});
after(async () => { if (h) await h.pool.end(); });

const API = new URL('../../app/api', import.meta.url).pathname;
function routes(dir = API, rel = '') {
  let out = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out = out.concat(routes(p, rel ? `${rel}/${n}` : n));
    else if (n === 'route.js') out.push(rel);
  }
  return out;
}
const params = new Proxy({}, { get: (_, k) => (typeof k === 'string' ? '1' : undefined) });

for (const body of ['{zepsuty', 'null', '[1,2]', '"tekst"', '42']) {
  test(`żadna trasa zapisu nie zwraca 500 dla treści ${body}`, { skip }, async () => {
    const bad = [];
    for (const route of routes()) {
      const mod = await import(`../../app/api/${route}/route.js`);
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        if (typeof mod[method] !== 'function') continue;
        h.jar.clear();
        await h.createSession(h.ids.ania);
        const res = await mod[method](new Request(`http://localhost/api/${route}`, { method, headers: { 'content-type': 'application/json' }, body }), { params: Promise.resolve(params) });
        // 503 = funkcja nieskonfigurowana w środowisku testowym (poczta, klucz API), nie błąd parsowania
        if (res.status >= 500 && res.status !== 503) bad.push(`${method} ${route}: ${res.status}`);
      }
    }
    assert.deepEqual(bad, []);
  });
}

test('logowanie: zły JSON to 400, a próby zużywają limit na IP (po 30 próbach 429)', { skip }, async () => {
  await h.q`DELETE FROM rate_limits`;
  const r = await h.call(null, 'auth/login', 'POST', '{zepsuty');
  assert.equal(r.status, 400);
  assert.match(r.json.error, /JSON/);
  for (let i = 0; i < 29; i++) await h.call(null, 'auth/login', 'POST', '{zepsuty');
  assert.equal((await h.call(null, 'auth/login', 'POST', '{zepsuty')).status, 429);
});

test('zmiana hasła i panel admina: zły JSON to 400 z polskim komunikatem', { skip }, async () => {
  for (const route of ['auth/change-password', 'admin/users']) {
    const r = await h.call(h.ids.ania, route, 'POST', '{');
    assert.equal(r.status, 400, route);
    assert.match(r.json.error, /Nieprawidłowe dane/);
  }
});

test('pusta treść nadal działa jak {} (zgodność wsteczna)', { skip }, async () => {
  const r = await h.call(h.ids.ania, 'auth/logout', 'POST');
  assert.equal(r.status, 200);
  const r2 = await h.call(h.ids.ania, 'reports', 'POST');
  assert.equal(r2.status, 400);
  assert.match(r2.json.error, /zgłoszenie/);
});
