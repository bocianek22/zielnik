// „Cofnij” po usunięciu recepty: DELETE zwraca własne powiązane zakupy, POST z `relink` wiąże je z odtworzoną receptą
// (tylko własne i niepowiązane), wykup recepty po odtworzeniu jest ten sam. Uruchom: TEST_DATABASE_URL=... npm run test:db.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

const KEY = `t1:${Buffer.alloc(32, 7).toString('base64')}`;
const OTHER = `t9:${Buffer.alloc(32, 9).toString('base64')}`;
const savedKey = process.env.DATA_ENCRYPTION_KEY;
let q, jar, pool, createSession;
const ids = {};

async function call(uid, route, method, body, params = {}) {
  jar.clear();
  if (uid) await createSession(uid);
  const mod = await import(`../../app/api/${route}/route.js`);
  const req = new Request(`http://localhost/api/${route}`, {
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
  process.env.DATA_ENCRYPTION_KEY = KEY;
  ({ pool } = await import('./neon-shim.mjs'));
  ({ jar } = await import('./headers-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  ({ createSession } = await import('../../lib/auth.js'));
  await db.ensureDb();
  q = db.sql();
  await q`INSERT INTO invites (code, max_uses) VALUES ('TEST', 10)`;
  for (const n of ['ania', 'bartek']) {
    const r = await call(null, 'auth/register', 'POST', { username: n, password: 'haslo1234', invite: 'test', adult: true, consent: true, healthConsent: true });
    assert.equal(r.status, 200, JSON.stringify(r.json));
  }
  for (const u of await q`SELECT id, username FROM users`) ids[u.username] = u.id;
});


const ok = (r) => { assert.ok(r.status < 400, JSON.stringify(r.json)); return r.json; };

test('odtworzenie recepty wiąże z nią z powrotem tylko własne, niepowiązane zakupy', { skip }, async () => {
  const A = ids.ania, B = ids.bartek;
  let r = ok(await call(A, 'prescriptions', 'POST', { issuedOn: '2026-09-01', validUntil: '2027-03-01', grams: 30, unit: 'g', note: 'dr Nowak' }));
  const rx = r.prescriptions[0];
  const sid = { id: ok(await call(A, 'strains', 'POST', { name: 'Cofka', producer: 'Aurora', type: 'haze' })).id };
  const buy = async (uid, g, rxId) => (await q`INSERT INTO purchases (user_id, strain_id, strain_name, grams, prescription_id, created_at)
    VALUES (${uid}, ${sid.id}, 'Cofka', ${g}, ${rxId}, '2026-09-10') RETURNING id`)[0].id;
  const p1 = await buy(A, 5, rx.id), p2 = await buy(A, 3, rx.id);
  const r2 = ok(await call(A, 'prescriptions', 'POST', { issuedOn: '2026-09-02', validUntil: '2027-03-01', grams: 10, unit: 'g' }));
  const other = r2.prescriptions.find((x) => x.id !== rx.id);
  const p3 = await buy(A, 2, other.id); // powiązany z inną receptą: nie wolno go przepiąć
  const pb = await buy(B, 4, null); // cudzy zakup
  const boughtBefore = (await call(A, 'prescriptions', 'GET')).json.prescriptions.find((x) => x.id === rx.id).bought;
  assert.equal(boughtBefore, 8);

  // bartek nie usunie cudzej recepty i nie dostanie listy jej zakupów
  const rb = ok(await call(B, 'prescriptions', 'DELETE', { id: rx.id }));
  assert.deepEqual(rb.relink, []);

  r = ok(await call(A, 'prescriptions', 'DELETE', { id: rx.id }));
  assert.deepEqual(r.relink.sort((a, b) => a - b), [p1, p2].sort((a, b) => a - b));
  assert.equal((await q`SELECT count(*)::int AS n FROM purchases WHERE id IN (${p1}, ${p2}) AND prescription_id IS NULL`)[0].n, 2);

  r = ok(await call(A, 'prescriptions', 'POST', { issuedOn: rx.issued_on, validUntil: rx.valid_until, grams: rx.grams, unit: rx.unit, note: rx.note, relink: [...r.relink, p3, pb, 'x', -1] }));
  const back = r.prescriptions.find((x) => x.issued_on === '2026-09-01');
  assert.equal(back.note, 'dr Nowak');
  assert.equal(back.bought, boughtBefore, 'wykup po odtworzeniu bez zmian');
  const links = Object.fromEntries((await q`SELECT id, prescription_id FROM purchases WHERE id IN (${p1}, ${p2}, ${p3}, ${pb})`).map((x) => [x.id, x.prescription_id]));
  assert.equal(links[p1], back.id);
  assert.equal(links[p2], back.id);
  assert.equal(links[p3], other.id, 'zakup z innej recepty bez zmian');
  assert.equal(links[pb], null, 'cudzy zakup bez zmian');
});
