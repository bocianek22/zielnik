// Wspólne przygotowanie dla testów tras API na lokalnym PostgreSQL (baza jest czyszczona).
export const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
export const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

export async function setup(users = ['ania', 'bartek']) {
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  const { pool } = await import('./neon-shim.mjs');
  const { jar, client } = await import('./headers-shim.mjs');
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  const { createSession } = await import('../../lib/auth.js');
  await db.ensureDb();
  const q = db.sql();
  const ids = {};
  for (const n of users) {
    const [u] = await q`INSERT INTO users (username, password_hash, must_change_password) VALUES (${n}, 'x', false) RETURNING id`;
    ids[n] = u.id;
  }
  // wywołanie trasy jako użytkownik uid (null = niezalogowany); body może być obiektem albo surowym tekstem
  async function call(uid, route, method, body, params = {}, query = '') {
    jar.clear();
    if (uid) await createSession(uid);
    const mod = await import(`../../app/api/${route}/route.js`);
    const req = new Request(`http://localhost/api/${route}${query}`, {
      method, headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const res = await mod[method](req, { params: Promise.resolve(params) });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, res, json: ct.includes('json') ? await res.json() : null, text: ct.includes('json') ? null : await res.text() };
  }
  return { q, pool, jar, client, ids, call, createSession };
}
