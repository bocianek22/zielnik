// Lekki indeks odmian, stronicowanie kursorem i pamięć podręczna wspólnych danych (POM-35 / PLA-5).
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, S, cacheStats;
const ids = {};
const strainIds = [];

async function call(uid, route, method, body, { qs = '', params = {} } = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}${qs}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const json = (res.headers.get('content-type') || '').includes('json') ? await res.json() : null;
  return { status: res.status, json };
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  ({ stats: cacheStats } = await import('./cache-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  S = await import('../../lib/strains.js');
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;

  // 7 odmian; trzy ostatnie z identycznym created_at (kursor musi rozstrzygać remisy po id)
  for (let i = 1; i <= 7; i++) {
    const r = await call(ids.ania, 'strains', 'POST', { name: `Odmiana ${i}`, producer: 'Producent A', type: 'Hybryda', taste: `smak ${i}`, thc: 20, form: i % 2 ? 'susz' : 'olej', terpenes: [] });
    assert.equal(r.status, 200, JSON.stringify(r.json));
    strainIds.push(r.json.id);
  }
  await q`UPDATE strains SET created_at = '2026-01-01T10:00:00.123456Z' WHERE id = ANY(${strainIds.slice(4)}::int[])`;
  // ania: stan na odmianach 1 i 3 (widoczność "me"), ocena na 2; bartek: widoczne oceny "all" na 1 i prywatna na 2, stan na 1
  const [s1, s2, s3] = strainIds;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount, notes, visibility) VALUES (${s1}, ${ids.ania}, 3.5, 'tajna notatka ani', 'me') ON CONFLICT (strain_id, user_id) DO UPDATE SET current_amount = 3.5, notes = 'tajna notatka ani'`;
  await q`INSERT INTO user_strain (strain_id, user_id, current_amount) VALUES (${s3}, ${ids.ania}, 1) ON CONFLICT (strain_id, user_id) DO UPDATE SET current_amount = 1`;
  await q`INSERT INTO user_strain (strain_id, user_id, rating, rated_at, effects, visibility) VALUES (${s2}, ${ids.ania}, 9, now(), '{"relax":9}'::jsonb, 'me') ON CONFLICT (strain_id, user_id) DO UPDATE SET rating = 9, rated_at = now(), effects = '{"relax":9}'::jsonb`;
  await q`INSERT INTO user_strain (strain_id, user_id, rating, rated_at, effects, visibility, current_amount) VALUES (${s1}, ${ids.bartek}, 7, now(), '{"relax":8}'::jsonb, 'all', 99) ON CONFLICT (strain_id, user_id) DO UPDATE SET rating = 7, rated_at = now(), effects = '{"relax":8}'::jsonb, visibility = 'all', current_amount = 99`;
  await q`INSERT INTO user_strain (strain_id, user_id, rating, rated_at, visibility) VALUES (${s2}, ${ids.bartek}, 4, now(), 'me') ON CONFLICT (strain_id, user_id) DO UPDATE SET rating = 4, rated_at = now(), visibility = 'me'`;
});

after(async () => { if (pool) await pool.end(); });

test('strainIndex jest zgodny z listStrains (kolejność, pola wspólne, moje „mam”) i nie niesie wpisów', { skip }, async () => {
  const full = await S.listStrains(ids.ania);
  const idx = await S.strainIndex({ viewerId: ids.ania });
  assert.deepEqual(idx.map((s) => s.id), full.map((s) => s.id));
  for (const [i, s] of idx.entries()) {
    const f = full[i];
    assert.equal(s.name, f.name); assert.equal(s.producer, f.producer); assert.equal(s.taste, f.taste);
    assert.equal(s.pool_key, f.pool_key); assert.equal(s.form, f.form);
    assert.equal(s.unit, f.form === 'olej' ? 'ml' : 'g');
    assert.equal(s.mine, f.entries.find((e) => e.userId === ids.ania).current);
    assert.equal('entries' in s, false);
    assert.equal('notes' in s, false);
  }
  // wersja bez użytkownika: jak dawny strainIndex(), bez pola „mam”
  const anon = await S.strainIndex();
  assert.deepEqual(anon.map((s) => s.id), full.map((s) => s.id));
  assert.equal('mine' in anon[0], false);
  // filtr po id
  const some = await S.strainIndex({ viewerId: ids.ania, ids: [strainIds[2], strainIds[0]] });
  assert.deepEqual(some.map((s) => s.id).sort(), [strainIds[0], strainIds[2]].sort());
});

test('strainIndex nie ujawnia cudzych stanów, a cache wspólnej części nie miesza użytkowników', { skip }, async () => {
  const [s1, , s3] = strainIds;
  const a = await S.strainIndex({ viewerId: ids.ania });
  const b = await S.strainIndex({ viewerId: ids.bartek });
  const pick = (rows, id) => rows.find((r) => r.id === id).mine;
  assert.equal(pick(a, s1), 3.5); assert.equal(pick(a, s3), 1);
  assert.equal(pick(b, s1), 99); assert.equal(pick(b, s3), 0);
  // wywołanie w odwrotnej kolejności nadal daje każdemu swoje wartości (wspólny wpis cache jest ten sam)
  assert.equal(pick(await S.strainIndex({ viewerId: ids.ania }), s1), 3.5);
  const hitsBefore = cacheStats.hits;
  await S.strainIndex({ viewerId: ids.bartek });
  assert.ok(cacheStats.hits > hitsBefore, 'wspólna lista powinna wychodzić z pamięci podręcznej');
  // zapis do pamięci podręcznej nie zawiera niczego osobistego
  const shared = await S.strainIndex();
  const text = JSON.stringify(shared);
  assert.ok(!/mine|notes|tajna|entries/.test(text));
  // stan użytkownika zmienia się natychmiast, mimo że wspólna część jest w cache
  await q`UPDATE user_strain SET current_amount = 8 WHERE strain_id = ${s1} AND user_id = ${ids.ania}`;
  assert.equal(pick(await S.strainIndex({ viewerId: ids.ania }), s1), 8);
  await q`UPDATE user_strain SET current_amount = 3.5 WHERE strain_id = ${s1} AND user_id = ${ids.ania}`;
});

test('edycja, dodanie i usunięcie odmiany unieważniają cache; nowa opcja także', { skip }, async () => {
  await S.strainIndex(); await S.listOptions(); // rozgrzanie
  const target = strainIds[1];
  await q`UPDATE users SET must_change_password = FALSE WHERE is_admin`;
  const r = await call(ids.Bocian, 'strains/[id]', 'PATCH', { name: 'Zmieniona nazwa', producer: 'Producent A', type: 'Hybryda', taste: 'nowy smak', form: 'olej', terpenes: [] }, { params: { id: String(target) } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  const row = (await S.strainIndex()).find((s) => s.id === target);
  assert.equal(row.name, 'Zmieniona nazwa'); assert.equal(row.taste, 'nowy smak');

  const add = await call(ids.ania, 'strains', 'POST', { name: 'Dodatkowa', producer: 'Nowy Producent XYZ', type: 'Hybryda', terpenes: [] });
  assert.equal(add.status, 200);
  assert.ok((await S.strainIndex()).some((s) => s.id === add.json.id));
  assert.ok((await S.listOptions()).producer.includes('Nowy Producent XYZ'));

  const del = await call(ids.ania, 'strains/[id]', 'DELETE', null, { params: { id: String(add.json.id) } });
  assert.equal(del.status, 200, JSON.stringify(del.json));
  assert.ok(!(await S.strainIndex()).some((s) => s.id === add.json.id));
});

test('stronicowanie kursorem: strony składają się w pełną listę bez dubli, także przy remisie created_at', { skip }, async () => {
  const full = (await S.listStrains(ids.ania)).map((s) => s.id);
  assert.ok(full.length >= 7);
  for (const limit of [1, 2, 3, full.length, full.length + 5]) {
    const got = []; let after = null; let pages = 0;
    do {
      const p = S.parsePaging(new URLSearchParams(pages ? { limit, cursor: after } : { limit }));
      assert.ok(!p.error, p.error);
      const page = await S.listStrainsPage(ids.ania, { limit: p.limit, after: p.after });
      assert.ok(page.strains.length <= limit);
      assert.equal('cur' in page.strains[0], false);
      got.push(...page.strains.map((s) => s.id));
      after = page.next; pages++;
    } while (after && pages < 50);
    assert.deepEqual(got, full, `limit=${limit}`);
  }
  // to samo dla indeksu i rankingu
  for (const fn of [(o) => S.strainIndexPage(ids.ania, o), (o) => S.rankingRows(ids.ania, o)]) {
    const got = []; let after = null; let guard = 0;
    do {
      const page = await fn({ limit: 3, after: after && S.parsePaging(new URLSearchParams({ cursor: after })).after });
      got.push(...page.strains.map((s) => s.id));
      after = page.next;
    } while (after && ++guard < 50);
    assert.deepEqual(got, full);
  }
});

test('parsePaging odrzuca błędny limit i kursor, ogranicza limit do PAGE_MAX', { skip }, async () => {
  const P = (o) => S.parsePaging(new URLSearchParams(o));
  assert.equal(P({}).limit, S.PAGE_MAX);
  assert.equal(P({ limit: '100000' }).limit, S.PAGE_MAX);
  for (const bad of ['0', '-1', 'abc', '1.5']) assert.ok(P({ limit: bad }).error, bad);
  for (const bad of ['x', '5', "2026-01-01T00:00:00.000000Z_1'; DROP TABLE strains;--", '2026-13-45T00:00:00.000000Z_1']) assert.ok(P({ cursor: bad }).error, bad);
});

test('GET /api/strains: limit/cursor, domyślnie wszystko do PAGE_MAX, view=index, błędy i brak sesji', { skip }, async () => {
  const full = (await S.listStrains(ids.ania)).map((s) => s.id);
  const all = await call(ids.ania, 'strains', 'GET');
  assert.equal(all.status, 200);
  assert.deepEqual(all.json.strains.map((s) => s.id), full);
  assert.equal(all.json.next, null);
  assert.ok(all.json.options.producer.length);

  const p1 = await call(ids.ania, 'strains', 'GET', null, { qs: '?limit=3' });
  assert.equal(p1.json.strains.length, 3);
  assert.ok(p1.json.next);
  const p2 = await call(ids.ania, 'strains', 'GET', null, { qs: `?limit=3&cursor=${encodeURIComponent(p1.json.next)}` });
  assert.deepEqual([...p1.json.strains, ...p2.json.strains].map((s) => s.id), full.slice(0, 6));

  const idx = await call(ids.ania, 'strains', 'GET', null, { qs: '?view=index&limit=2' });
  assert.deepEqual(idx.json.strains.map((s) => s.id), full.slice(0, 2));
  assert.ok(idx.json.next);
  assert.equal('entries' in idx.json.strains[0], false);
  assert.equal(typeof idx.json.strains[0].mine, 'number');

  assert.equal((await call(ids.ania, 'strains', 'GET', null, { qs: '?limit=abc' })).status, 400);
  assert.equal((await call(ids.ania, 'strains', 'GET', null, { qs: '?cursor=zly' })).status, 400);
  assert.equal((await call(null, 'strains', 'GET')).status, 401);
});

test('wheelItems i rankingRows zgadzają się z listStrains i nie pokazują cudzych danych', { skip }, async () => {
  for (const uid of [ids.ania, ids.bartek]) {
    const full = await S.listStrains(uid);
    const wheelOld = full.map((s) => ({ s, mine: s.entries.find((e) => e.userId === uid) })).filter(({ mine }) => mine && mine.current > 0)
      .map(({ s, mine }) => ({ id: s.id, name: s.name, producer: s.producer, type: s.type, kind: s.kind, thc: s.thc, form: s.form, current: mine.current }));
    assert.deepEqual(await S.wheelItems(uid), wheelOld);

    const { strainTags } = await import('../../lib/effects.js');
    const rankOld = full.map((s) => ({
      id: s.id, name: s.name, producer: s.producer, type: s.type, kind: s.kind, form: s.form || 'susz', thc: s.thc, tags: strainTags(s),
      ratings: s.entries.filter((e) => e.rating != null).map((e) => ({ userId: e.userId, rating: e.rating, at: e.ratedAt })),
    }));
    const { strains, next } = await S.rankingRows(uid);
    assert.equal(next, null);
    assert.deepEqual(strains, rankOld);
  }
  // ania nie widzi prywatnej oceny bartka (visibility 'me'), widzi jego publiczną
  const a = (await S.rankingRows(ids.ania)).strains;
  assert.deepEqual(a.find((s) => s.id === strainIds[1]).ratings.map((r) => r.userId), [ids.ania]);
  assert.ok(a.find((s) => s.id === strainIds[0]).ratings.some((r) => r.userId === ids.bartek));
  // koło: stan bartka (99) nie trafia do ani, nawet jawny
  assert.ok(!(await S.wheelItems(ids.ania)).some((w) => w.current === 99));
  // payload rankingu bez notatek i efektów
  assert.ok(!/tajna|effects|notes/.test(JSON.stringify(a)));
});

test('indeksy stronicowania istnieją i ensureDb nadal jest idempotentne', { skip }, async () => {
  const { ensureDb } = await import('../../lib/db.js');
  await ensureDb();
  const rows = await q`SELECT indexname FROM pg_indexes WHERE indexname IN ('strains_created_idx', 'user_strain_stock_idx')`;
  assert.equal(rows.length, 2);
});
