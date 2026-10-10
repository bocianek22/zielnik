// Prognoza zapasu w panelu „Dziś” (lib/forecast.js + dailyUse().forecast): zakres tempa od najwolniejszego do najszybszego tygodnia z 4.
// Uruchom: TEST_DATABASE_URL=postgres://... npm run test:db  (baza zostanie WYCZYSZCZONA).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { rateRange, MIN_DAYS } from '../../lib/forecast.js';

const URL_ = process.env.TEST_DATABASE_URL;
const local = URL_ && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL_);
const skip = !URL_ ? 'brak TEST_DATABASE_URL'
  : !local && process.env.ALLOW_REMOTE_TEST_DB !== '1' ? 'TEST_DATABASE_URL nie wskazuje na localhost (ustaw ALLOW_REMOTE_TEST_DB=1)' : false;

let q, pool, strains;
const ids = {};
const S = {};

// wpis z południa polskiego dnia sprzed `ago` dni (południe, żeby strefa i pora nie przesuwały dnia)
const at = (ago) => `((now() AT TIME ZONE 'Europe/Warsaw')::date - ${ago} + time '12:00') AT TIME ZONE 'Europe/Warsaw'`;
async function use(user, strain, grams, ago) {
  await q.query(`INSERT INTO usage_log (user_id, strain_id, grams, created_at) VALUES ($1, $2, $3, ${at(ago)})`, [user, strain, grams]);
}

before(async () => {
  if (skip) return;
  process.env.DATABASE_URL = URL_;
  process.env.AUTH_SECRET ||= 'test-secret-0123456789';
  process.env.BOCIAN_INITIAL_PASSWORD ||= 'startowe-haslo';
  ({ pool } = await import('./neon-shim.mjs'));
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
  const db = await import('../../lib/db.js');
  strains = await import('../../lib/strains.js');
  await db.ensureDb();
  q = db.sql();
  for (const n of ['ania', 'bartek', 'celina']) {
    const [u] = await q`INSERT INTO users (username, password_hash) VALUES (${n}, 'x') RETURNING id`;
    ids[n] = u.id;
  }
  for (const [key, name, form] of [['g', 'Lemon', 'susz'], ['ml', 'Olej', 'olej']]) {
    const [r] = await q`INSERT INTO strains (producer, name, type, thc, cbd, form, created_by) VALUES ('Aurora', ${name}, 'haze', 20, 0, ${form}, ${ids.ania}) RETURNING id`;
    S[key] = r.id;
  }
});

after(async () => { if (pool) await pool.end(); });

test('rateRange: najwolniejszy i najszybszy pełny tydzień, bez pasma przy < 14 dniach z wpisami', () => {
  assert.equal(MIN_DAYS, 14);
  const day = (ago) => { const d = new Date('2026-10-09T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ago); return d.toISOString().slice(0, 10); };
  const rows = (agos, v) => agos.map((a) => ({ day: day(a), total: typeof v === 'function' ? v(a) : v }));
  const range = (r) => rateRange(r, '2026-10-09');
  // 13 dni z rzędu: za mało
  assert.deepEqual(range(rows([...Array(13).keys()], 1)), { days: 13, minRate: null, maxRate: null });
  // 14 dni po 1: dwa pełne tygodnie, oba 1/dzień
  assert.deepEqual(range(rows([...Array(14).keys()], 1)), { days: 14, minRate: 1, maxRate: 1 });
  // 28 dni, tygodnie 0,5 / 1 / 2 / 1,5 na dzień
  const w = [0.5, 1, 2, 1.5];
  assert.deepEqual(range(rows([...Array(28).keys()], (a) => w[Math.floor(a / 7)])), { days: 28, minRate: 0.5, maxRate: 2 });
  // przerwy w zapisach liczą się jako zero w sumie tygodnia, a dni z wpisami zliczane są bez powtórzeń
  const sparse = rows([0, 1, 3, 5, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17], 2);
  assert.deepEqual(range(sparse), { days: 14, minRate: (2 * 4) / 7, maxRate: (2 * 6) / 7 });
});

test('dailyUse: forecast liczy tempo tygodni osobno dla g i ml, a perDay zostaje średnią z 30 dni', { skip }, async () => {
  const A = ids.ania;
  // susz: 20 dni z rzędu, ostatni tydzień 0,5 g/dzień, poprzedni 1 g/dzień (trzeci tydzień nie jest pełny po pierwszym wpisie, więc nie liczy się)
  for (let ago = 0; ago < 20; ago++) await use(A, S.g, ago < 7 ? 0.5 : 1, ago);
  // olej: tylko 10 dni, za mało na zakres
  for (let ago = 0; ago < 10; ago++) await use(A, S.ml, 0.3, ago);
  // cudze wpisy nie wpływają na wynik
  for (let ago = 0; ago < 28; ago++) await use(ids.bartek, S.g, 5, ago);

  const du = await strains.dailyUse(A);
  assert.equal(du.forecast.g.days, 20);
  assert.equal(du.forecast.g.minRate, 0.5);
  assert.equal(du.forecast.g.maxRate, 1);
  assert.deepEqual(du.forecast.ml, { days: 10, minRate: null, maxRate: null });
  // dotychczasowe pola bez zmian: suma 3,5 + 13 = 16,5 g na liczbę dni od pierwszego wpisu (19 dni temu, południe);
  // przed południem polskim dzisiejszy wpis jest jeszcze w przyszłości, więc dzielnik to 19 albo 20 zależnie od godziny testu
  assert.ok([19, 20].some((n) => Math.abs(du.perDay - 16.5 / n) < 1e-9), `perDay ${du.perDay}`);
  assert.ok(du.perDayMl > 0);
});

test('dailyUse: bez wpisów forecast jest pusty (null, bez błędu)', { skip }, async () => {
  const du = await strains.dailyUse(ids.celina);
  assert.equal(du.perDay, 0);
  assert.deepEqual(du.forecast, { g: { days: 0, minRate: null, maxRate: null }, ml: { days: 0, minRate: null, maxRate: null } });
});
