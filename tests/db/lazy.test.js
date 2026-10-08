// MOB-10 / DT-4: wiersze user_strain powstają dopiero przy pierwszym zapisie (nie dla każdej pary użytkownik × odmiana),
// a lista odmian nadal pokazuje oglądającemu jego (pusty) wpis. Do tego nowa postać "znajomych znajomych" w can_see.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, jar, pool, createSession, listStrains;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
    method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const res = await mod[method](req, { params: Promise.resolve(params) });
  const ct = res.headers.get('content-type') || '';
  const json = ct.includes('json') ? await res.json() : null;
  const text = !json && ct.includes('text') ? await res.text() : null;
  return { status: res.status, json, text };
}

const register = async (username) => {
  const r = await call(null, 'auth/register', 'POST', { username, password: 'haslo1234', invite: 'lazy', adult: true, consent: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return (await q`SELECT id FROM users WHERE username = ${username}`)[0].id;
};
const rows = async (where) => (await pool.query(`SELECT strain_id, user_id FROM user_strain WHERE ${where} ORDER BY 1, 2`)).rows;
const create = async (uid, body) => {
  const r = await call(uid, 'strains', 'POST', { producer: 'Aurora', type: 'haze', ...body });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.id;
};
// puste wiersze (bez oceny, opinii, odczuć i stanu) - tak wyglądają dane po ewentualnym sprzątaniu starych wierszy;
// usunięcie ich przed sprawdzeniem pokazuje, że kod nie zakłada istnienia wiersza (także na starym kodzie)
const dropEmpty = (uid) => pool.query(`DELETE FROM user_strain WHERE user_id = $1 AND rating IS NULL AND notes = ''
  AND effects = '{}'::jsonb AND current_amount = 0 AND price_per_g IS NULL`, [uid]);
const strainOf = async (viewer, id) => (await listStrains(viewer)).find((s) => s.id === id);

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
  ({ listStrains } = await import('../../lib/strains.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('LAZY', 50)`;
  for (const n of ['ania', 'bartek']) ids[n] = await register(n);
});

after(async () => { if (pool) await pool.end(); });

test('nowa odmiana tworzy wpis tylko dla twórcy, rejestracja nie tworzy żadnych', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Leniwa' });
  assert.deepEqual(await rows(`strain_id = ${s}`), [{ strain_id: s, user_id: A }]);
  const C = await register('celina');
  ids.celina = C;
  assert.deepEqual(await rows(`user_id = ${C}`), []);
  assert.deepEqual(await rows(`user_id = ${B}`), []);
});

test('konto założone przez admina nie dostaje wierszy dla wszystkich odmian', { skip }, async () => {
  const [admin] = await q`SELECT id FROM users WHERE is_admin`;
  await q`UPDATE users SET must_change_password = FALSE WHERE id = ${admin.id}`;
  const r = await call(admin.id, 'admin/users', 'POST', { username: 'zadmina', password: 'tymczasowe1' });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(await rows(`user_id = ${r.json.user.id}`), []);
});

test('import tworzy wpisy tylko importującemu, z jego oceną, stanem i "do wykupienia"', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const r = await call(B, 'import', 'POST', { rows: [
    { name: 'Z importu', producer: 'Tilray', type: 'kush', rating: '7,5', current: '3', remaining: '4', notes: 'dobra', thc: '20', cbd: '1' },
    { name: 'Bez oceny', producer: 'Tilray', type: 'kush' },
  ] });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.added, 2);
  const [s1, s2] = (await q`SELECT id FROM strains WHERE name IN ('Z importu', 'Bez oceny') ORDER BY name DESC`).map((x) => x.id);
  assert.deepEqual(await rows(`strain_id IN (${s1}, ${s2})`), [{ strain_id: s1, user_id: B }, { strain_id: s2, user_id: B }]);
  const mine = (await strainOf(B, s1)).entries.find((e) => e.userId === B);
  assert.equal(Number(mine.rating), 7.5);
  assert.ok(mine.ratedAt);
  assert.equal(Number(mine.current), 3);
  assert.equal(Number(mine.remaining), 4);
  assert.equal(mine.notes, 'dobra');
  const empty = (await strainOf(B, s2)).entries.find((e) => e.userId === B);
  assert.equal(empty.rating, null);
  assert.equal(empty.ratedAt, null);
  assert.equal(Number(empty.current), 0);
  // inni widzą odmiany z importu bez wierszy
  assert.ok((await strainOf(A, s1)).entries.some((e) => e.userId === A));
});

test('użytkownik bez wiersza widzi istniejące odmiany z pustym własnym wpisem (ten sam kształt co zapisany)', { skip }, async () => {
  const { ania: A } = ids;
  const D = await register('darek');
  ids.darek = D;
  const s = await create(A, { name: 'Do obejrzenia' });
  await call(A, 'strains/[id]/entry', 'PUT', { rating: 8, notes: 'super', visibility: 'all', current: 2 }, { id: String(s) });
  await dropEmpty(D);
  const st = await strainOf(D, s);
  const own = st.entries.find((e) => e.userId === D);
  assert.deepEqual({ ...own, current: Number(own.current), remaining: Number(own.remaining) }, {
    userId: D, username: 'darek', displayName: '', rating: null, ratedAt: null, current: 0, remaining: 0,
    notes: '', effects: {}, visibility: 'me', price: null,
  });
  const other = st.entries.find((e) => e.userId === A);
  assert.equal(Number(other.rating), 8);
  assert.equal(other.current, null);
  assert.equal(other.visibility, null);
  // wszystkie wpisy mają te same pola, posortowane po nazwie użytkownika
  const keys = Object.keys(own).sort();
  for (const e of st.entries) assert.deepEqual(Object.keys(e).sort(), keys);
  assert.deepEqual(st.entries.map((e) => e.username), ['ania', 'darek']);
  // twórca widzi swój wpis, a ktoś bez treści nie pojawia się u innych
  assert.deepEqual((await strainOf(A, s)).entries.map((e) => e.username), ['ania']);
  // ids: tylko wybrane odmiany, w tym samym kształcie
  const [one] = await listStrains(D, { ids: [s] });
  assert.deepEqual(one, st);
  assert.equal((await listStrains(D, { ids: [] })).length, 0);
  // oglądający 0 (bez konta) nie dostaje pustego wpisu
  assert.deepEqual((await strainOf(0, s)).entries.map((e) => e.username), ['ania']);
});

test('bez wiersza można ocenić, zapisać odczucia, zużyć, wykupić, ustawić "do wykupienia" i dodać test', { skip }, async () => {
  const { ania: A } = ids;
  const E = await register('ewa');
  const mk = (n) => create(A, { name: n, thc: 18, cbd: 0, producer: 'Cosma' });
  const p = (id) => ({ id: String(id) });

  const rated = await mk('Ocena');
  const felt = await create(A, { name: 'Odczucia' });
  const used = await create(A, { name: 'Zużycie' });
  const bought = await create(A, { name: 'Wykup', price: 50 });
  const mate = await mk('Ta sama pula');
  const tested = await create(A, { name: 'Test' });
  await dropEmpty(E);
  const r1 = await call(E, 'strains/[id]/entry', 'PUT', { rating: 6, notes: 'ok', remaining: 5 }, p(rated));
  assert.equal(r1.status, 200, JSON.stringify(r1.json));
  assert.equal(r1.json.entry.rating, 6);

  const r2 = await call(E, 'strains/[id]/effects', 'PUT', { effects: { sleep: 7 } }, p(felt));
  assert.equal(r2.status, 200, JSON.stringify(r2.json));
  assert.equal((await strainOf(E, felt)).entries.find((e) => e.userId === E).effects.sleep, 7);

  const r3 = await call(E, 'strains/[id]/usage', 'POST', { grams: 1 }, p(used));
  assert.deepEqual({ ...r3.json, id: undefined }, { current: 0, used: 1, stockShort: true, id: undefined }); // id wpisu do „Cofnij” (POM-02)

  const r4 = await call(E, 'strains/[id]/purchase', 'POST', { grams: 2.5 }, p(bought));
  assert.equal(r4.status, 200, JSON.stringify(r4.json));
  assert.equal(r4.json.current, 2.5);
  const r4b = await call(E, 'strains/[id]/purchase', 'POST', { grams: 1 }, p(bought));
  assert.equal(r4b.json.current, 3.5);
  const [pu] = await q`SELECT SUM(grams)::float8 AS g, SUM(cost)::float8 AS c FROM purchases WHERE user_id = ${E} AND strain_id = ${bought}`;
  assert.deepEqual(pu, { g: 3.5, c: 175 });
  assert.equal(Number((await strainOf(E, bought)).entries.find((e) => e.userId === E).current), 3.5);

  // "do wykupienia" jest wspólne dla puli (Cosma, 18% THC): ustawione przy "Ocena", widać je też przy nowej odmianie z tej puli
  assert.deepEqual(await rows(`strain_id = ${mate} AND user_id = ${E}`), []);
  assert.equal(Number((await strainOf(E, mate)).entries.find((e) => e.userId === E).remaining), 5);
  const r5 = await call(E, 'strains/[id]/purchase', 'POST', { grams: 2 }, p(mate));
  assert.deepEqual({ ...r5.json, id: undefined }, { current: 2, remaining: 3, bought: 2, prescriptionId: null, id: undefined });

  const r6 = await call(E, 'strains/[id]/tests', 'POST', { note: 'pomiar', visibility: 'all' }, p(tested));
  assert.equal(r6.status, 200, JSON.stringify(r6.json));
  assert.equal(r6.json.tests.length, 1);

  // nieistniejąca odmiana: 404 i bez osieroconych zapisów
  const r7 = await call(E, 'strains/[id]/purchase', 'POST', { grams: 1 }, p(999999));
  assert.equal(r7.status, 404);
  assert.equal((await q`SELECT count(*)::int AS n FROM purchases WHERE strain_id = 999999`)[0].n, 0);
});

test('równoległe pierwsze wykupy bez wiersza nie gubią się', { skip }, async () => {
  const { ania: A } = ids;
  const F = await register('filip');
  const s = await create(A, { name: 'Wyścig bez wiersza' });
  await dropEmpty(F);
  const purchase = await import('../../app/api/strains/[id]/purchase/route.js');
  jar.clear();
  await createSession(F);
  const req = () => new Request('http://localhost/', { method: 'POST', body: JSON.stringify({ grams: 1 }) });
  const res = await Promise.all(Array.from({ length: 6 }, () => purchase.POST(req(), { params: Promise.resolve({ id: String(s) }) })));
  for (const r of res) assert.equal(r.status, 200);
  assert.equal(Number((await q`SELECT current_amount FROM user_strain WHERE strain_id = ${s} AND user_id = ${F}`)[0].current_amount), 6);
});

test('rankingi, eksporty i kopia działają bez wierszy', { skip }, async () => {
  const { ania: A } = ids;
  const G = await register('gosia');
  const s = await create(A, { name: 'Rankingowa' });
  await call(A, 'strains/[id]/entry', 'PUT', { rating: 9, visibility: 'all' }, { id: String(s) });
  await dropEmpty(G);
  // ranking (strona /rankings liczy z entries): ocena Ani widoczna dla osoby bez żadnych wierszy
  const ratings = (await strainOf(G, s)).entries.filter((e) => e.rating != null).map((e) => [e.username, Number(e.rating)]);
  assert.deepEqual(ratings, [['ania', 9]]);
  // eksport CSV: każda odmiana ma wiersz, puste pola osobiste
  const csv = await call(G, 'export', 'GET');
  assert.equal(csv.status, 200);
  const line = csv.text.split('\r\n').find((l) => l.startsWith('Rankingowa;'));
  assert.ok(line, 'brak odmiany w eksporcie CSV');
  assert.match(line, /;;0;0;;g$/); // twoja ocena pusta, stan 0, do wykupienia 0, bez spostrzeżeń, jednostka
  // eksport RODO: bez wpisów, bez błędu
  const acc = await call(G, 'account/export', 'GET');
  assert.equal(acc.status, 200);
  assert.deepEqual(acc.json.entries, []);
  // kopia zapasowa
  const { buildBackup } = await import('../../lib/backup.js');
  const b = await buildBackup();
  assert.ok(b.user_strain.some((r) => r.strain_id === s && r.user_id === A));
  assert.ok(!b.user_strain.some((r) => r.user_id === G));
});

test('usuwanie: twórca usuwa odmianę, której nikt nie ruszył, mimo że inni ją "widzą"', { skip }, async () => {
  const { ania: A, bartek: B } = ids;
  const s = await create(A, { name: 'Do usunięcia' });
  await listStrains(B); // samo oglądanie nie tworzy wierszy
  assert.deepEqual(await rows(`strain_id = ${s}`), [{ strain_id: s, user_id: A }]);
  assert.equal((await call(A, 'strains/[id]', 'DELETE', null, { id: String(s) })).status, 200);
});

test('can_see: "znajomi znajomych" daje te same wyniki co poprzednia definicja', { skip }, async () => {
  // poprzednia (wolna) definicja jako funkcja pomocnicza tylko w bazie testowej
  await pool.query(`CREATE OR REPLACE FUNCTION can_see_old(p_viewer INT, p_owner INT, p_vis TEXT) RETURNS BOOLEAN AS $$
    SELECT p_viewer = p_owner OR (
      NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = p_viewer AND b.blocked = p_owner) OR (b.blocker = p_owner AND b.blocked = p_viewer))
      AND (p_vis = 'all'
      OR (p_vis IN ('friends', 'fof') AND EXISTS (
            SELECT 1 FROM friendships f WHERE f.status = 'accepted'
              AND ((f.requester = p_viewer AND f.addressee = p_owner) OR (f.requester = p_owner AND f.addressee = p_viewer))))
      OR (p_vis = 'fof' AND EXISTS (
            SELECT 1 FROM friendships f1 JOIN friendships f2 ON f1.status = 'accepted' AND f2.status = 'accepted'
            WHERE (CASE WHEN f1.requester = p_viewer THEN f1.addressee WHEN f1.addressee = p_viewer THEN f1.requester END)
                = (CASE WHEN f2.requester = p_owner THEN f2.addressee WHEN f2.addressee = p_owner THEN f2.requester END)))
      ))
  $$ LANGUAGE SQL STABLE`);
  await pool.query(`INSERT INTO users (username, password_hash) SELECT 'graf' || g, 'x' FROM generate_series(1, 14) g`);
  // losowy (ale powtarzalny) graf znajomości z zaproszeniami oczekującymi i blokadami
  await pool.query(`SELECT setseed(0.7)`);
  await pool.query(`INSERT INTO friendships (requester, addressee, status)
    SELECT a.id, b.id, CASE WHEN random() < 0.75 THEN 'accepted' ELSE 'pending' END
    FROM users a JOIN users b ON a.id < b.id WHERE a.username LIKE 'graf%' AND b.username LIKE 'graf%' AND random() < 0.2
    ON CONFLICT DO NOTHING`);
  await pool.query(`INSERT INTO blocks (blocker, blocked) SELECT a.id, b.id FROM users a JOIN users b ON a.id <> b.id
    WHERE a.username LIKE 'graf%' AND b.username LIKE 'graf%' AND random() < 0.03 ON CONFLICT DO NOTHING`);
  const { rows: diff } = await pool.query(`
    SELECT v.id AS viewer, o.id AS owner, vis, can_see(v.id, o.id, vis) AS now, can_see_old(v.id, o.id, vis) AS old
    FROM users v CROSS JOIN users o CROSS JOIN unnest(ARRAY['me', 'friends', 'fof', 'all']) vis
    WHERE can_see(v.id, o.id, vis) IS DISTINCT FROM can_see_old(v.id, o.id, vis)`);
  assert.deepEqual(diff, []);
  const { rows: [n] } = await pool.query(`SELECT count(*) FILTER (WHERE can_see(v.id, o.id, 'fof') AND NOT can_see(v.id, o.id, 'friends'))::int AS fof_only
    FROM users v CROSS JOIN users o`);
  assert.ok(n.fof_only > 0, 'graf testowy nie ma żadnej pary "tylko znajomi znajomych"');
  await pool.query('DROP FUNCTION can_see_old(INT, INT, TEXT)');
});
