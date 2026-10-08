// BETA-A: „Zgłoś uwagę” (beta_feedback): własne zgłoszenia, uprawnienia admina, limit, maskowanie ścieżki,
// powiadomienie bez treści, eksport konta i kopia zapasowa.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, jar, createSession, mail, realFetch;
const ids = {};
const hooks = [];

async function call(uid, route, method, body) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const res = await mod[method](new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  }));
  await mail.flushBackground();
  return { status: res.status, json: (res.headers.get('content-type') || '').includes('json') ? await res.json() : null };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  mail = await import('../../lib/mail.js');
  await db.ensureDb();
  q = db.sql();
  const bcrypt = (await import('bcryptjs')).default;
  const hash = await bcrypt.hash('haslo1234', 4);
  await q`INSERT INTO users (username, password_hash, is_admin, must_change_password) VALUES ('szef', ${hash}, TRUE, FALSE), ('ania', ${hash}, FALSE, FALSE), ('bartek', ${hash}, FALSE, FALSE)`;
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    hooks.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(null, { status: 204 });
  };
});

after(async () => {
  if (realFetch) globalThis.fetch = realFetch;
  delete process.env.ALERT_WEBHOOK_URL;
  if (pool) await pool.end();
});

test('własne zgłoszenia: zapis, lista ze statusem, cudze niewidoczne, walidacja', { skip }, async () => {
  assert.equal((await call(null, 'feedback', 'GET')).status, 401);
  assert.equal((await call(null, 'feedback', 'POST', { kind: 'błąd', body: 'x' })).status, 401);
  for (const b of [{ kind: 'zły', body: 'x' }, { kind: 'błąd', body: '   ' }, { kind: 'błąd' }, { kind: 'błąd', body: 'a'.repeat(2001) }]) {
    assert.equal((await call(ids.ania, 'feedback', 'POST', b)).status, 400, JSON.stringify(b).slice(0, 40));
  }
  const ok = await call(ids.ania, 'feedback', 'POST', { kind: 'pomysł', body: '  Przydałby się ciemniejszy motyw  ' });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.items.length, 1);
  const mine = (await call(ids.ania, 'feedback', 'GET')).json.items;
  assert.deepEqual(mine.map((i) => [i.kind, i.body, i.status]), [['pomysł', 'Przydałby się ciemniejszy motyw', 'nowe']]);
  assert.equal('admin_note' in mine[0], false);
  assert.deepEqual((await call(ids.bartek, 'feedback', 'GET')).json.items, [], 'cudze zgłoszenia są niewidoczne');
  assert.equal((await call(ids.ania, 'feedback', 'POST', { kind: 'inne', body: 'a'.repeat(2000) })).status, 200);
});

test('meta: biała lista pól, ścieżka bez identyfikatorów i nazw kont', { skip }, async () => {
  const r = await call(ids.bartek, 'feedback', 'POST', {
    kind: 'błąd', body: 'Nie działa',
    meta: { version: '0.48.0', path: '/u/Kasia-Haze', platform: 'apk', theme: 'dark', discreet: true, viewport: '390x844', health: 'ból głowy', email: 'a@b.pl' },
  });
  assert.equal(r.status, 200);
  const [row] = await q`SELECT meta FROM beta_feedback WHERE id = ${r.json.id}`;
  assert.deepEqual(row.meta, { version: '0.48.0', path: '/u/:handle', platform: 'apk', theme: 'dark', discreet: true, viewport: '390x844' });
  const masked = async (path) => {
    const x = await call(ids.bartek, 'feedback', 'POST', { kind: 'inne', body: 'm', meta: { path } });
    return (await q`SELECT meta FROM beta_feedback WHERE id = ${x.json.id}`)[0].meta.path;
  };
  assert.equal(await masked('/strains/123/tests?token=tajny#x'), '/strains/:id/tests');
  assert.equal(await masked('/wiedza/moj-tajny-slug'), '/wiedza/:id');
  assert.equal(await masked('/pomoc'), '/pomoc');
  assert.equal(await masked('bez-ukosnika'), null);
  const junk = await call(ids.bartek, 'feedback', 'POST', { kind: 'inne', body: 'm', meta: { version: 'v<script>', platform: 'toster', theme: 'x', viewport: 'duży', discreet: 'tak' } });
  assert.deepEqual((await q`SELECT meta FROM beta_feedback WHERE id = ${junk.json.id}`)[0].meta,
    { version: null, path: null, platform: null, theme: null, discreet: false, viewport: null });
});

test('admin: lista wszystkich, status i notatka; zwykły użytkownik odmowa; autor widzi status, nie notatkę', { skip }, async () => {
  assert.equal((await call(ids.ania, 'admin/feedback', 'GET')).status, 403);
  assert.equal((await call(ids.ania, 'admin/feedback', 'POST', { id: 1, status: 'zrobione' })).status, 403);
  const all = (await call(ids.szef, 'admin/feedback', 'GET')).json.items;
  assert.ok(all.length >= 5);
  assert.deepEqual([...new Set(all.map((i) => i.username))].sort(), ['ania', 'bartek']);
  const target = all.find((i) => i.username === 'ania' && i.kind === 'pomysł');
  assert.equal((await call(ids.szef, 'admin/feedback', 'POST', { id: target.id, status: 'nieznany' })).status, 400);
  assert.equal((await call(ids.szef, 'admin/feedback', 'POST', { id: 999999, status: 'zrobione' })).status, 404);
  const r = await call(ids.szef, 'admin/feedback', 'POST', { id: target.id, status: 'w_toku', note: 'sprawdzę w piątek' });
  assert.equal(r.status, 200);
  const upd = r.json.items.find((i) => i.id === target.id);
  assert.deepEqual([upd.status, upd.note], ['w_toku', 'sprawdzę w piątek']);
  // sama zmiana statusu nie kasuje notatki
  await call(ids.szef, 'admin/feedback', 'POST', { id: target.id, status: 'zrobione' });
  assert.equal((await call(ids.szef, 'admin/feedback', 'GET')).json.items.find((i) => i.id === target.id).note, 'sprawdzę w piątek');
  const seen = (await call(ids.ania, 'feedback', 'GET')).json.items.find((i) => i.id === target.id);
  assert.equal(seen.status, 'zrobione');
  assert.ok(!JSON.stringify(seen).includes('piątek'));
  assert.equal((await call(ids.bartek, 'feedback', 'GET')).json.items.some((i) => i.id === target.id), false);
});

test('limit 10 zgłoszeń na godzinę na użytkownika', { skip }, async () => {
  await q`DELETE FROM rate_limits WHERE key LIKE 'feedback:%'`;
  const body = { kind: 'inne', body: 'limit' };
  for (let i = 0; i < 10; i++) assert.equal((await call(ids.ania, 'feedback', 'POST', body)).status, 200, `zgłoszenie ${i + 1}`);
  assert.equal((await call(ids.ania, 'feedback', 'POST', body)).status, 429);
  assert.equal((await call(ids.bartek, 'feedback', 'POST', body)).status, 200, 'limit jest per użytkownik');
});

test('powiadomienie na webhook: tylko kategoria i numer, bez treści i nazwy autora', { skip }, async () => {
  assert.equal(hooks.length, 0, 'bez ALERT_WEBHOOK_URL nic nie wychodzi');
  process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/T/B/klucz';
  await q`DELETE FROM rate_limits WHERE key LIKE 'feedback:%'`;
  const SECRET = 'mam silny bol glowy po odmianie Lemon Skunk, haslo: tajne123';
  const r = await call(ids.bartek, 'feedback', 'POST', { kind: 'błąd', body: SECRET, meta: { path: '/strains/5' } });
  assert.equal(r.status, 200);
  assert.equal(hooks.length, 1);
  const text = hooks[0].body.text;
  assert.ok(text.includes(`#${r.json.id}`) && text.includes('błąd'), text);
  for (const leak of [SECRET, 'glowy', 'tajne', 'bartek', 'Lemon', '/strains']) assert.ok(!text.includes(leak), `wyciek: ${leak}`);
});

test('eksport konta zawiera własne zgłoszenia (bez cudzych i bez notatki admina); kopia zapasowa obejmuje tabelę', { skip }, async () => {
  const ex = (await call(ids.ania, 'account/export', 'GET')).json;
  assert.ok(ex.feedback.length >= 2);
  assert.ok(ex.feedback.every((f) => ['błąd', 'pomysł', 'inne'].includes(f.kind) && f.body && f.status));
  assert.ok(!JSON.stringify(ex.feedback).includes('Nie działa'), 'zgłoszenie bartka nie trafia do eksportu ani');
  assert.ok(!JSON.stringify(ex.feedback).includes('piątek'), 'notatka admina nie jest eksportowana');
  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.ok(Array.isArray(b.beta_feedback) && b.beta_feedback.length >= 10);
});

test('usunięcie konta kasuje jego zgłoszenia', { skip }, async () => {
  const [{ n }] = await q`SELECT count(*)::int AS n FROM beta_feedback WHERE user_id = ${ids.bartek}`;
  assert.ok(n > 0);
  await q`DELETE FROM users WHERE id = ${ids.bartek}`;
  assert.equal((await q`SELECT count(*)::int AS n FROM beta_feedback WHERE user_id = ${ids.bartek}`)[0].n, 0);
  assert.ok((await q`SELECT count(*)::int AS n FROM beta_feedback WHERE user_id = ${ids.ania}`)[0].n > 0);
});
