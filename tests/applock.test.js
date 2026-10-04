// POM-25: skrót PIN, limit prób, czas blokady, bezczynność, skrypt startowy
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as L from '../lib/applock.js';

const store = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('PIN: 4-8 cyfr', () => {
  for (const p of ['1234', '12345678']) assert.ok(L.validPin(p));
  for (const p of ['123', '123456789', '12a4', '', ' 1234', null, 1234]) assert.ok(!L.validPin(p));
});

test('skrót PIN: PBKDF2 z solą, bez PIN-u w rekordzie, weryfikacja', async () => {
  const a = await L.makeRecord('4821', 5), b = await L.makeRecord('4821', 5);
  assert.notEqual(a.hash, b.hash); // różna sól
  assert.ok(!JSON.stringify(a).includes('4821'));
  assert.equal(a.iter, 310000);
  assert.ok(await L.verifyPin('4821', a));
  assert.ok(!(await L.verifyPin('4822', a)));
  assert.ok(!(await L.verifyPin('abc', a)));
  assert.ok(!(await L.verifyPin('4821', null)));
  assert.equal((await L.makeRecord('1234', 7)).mins, 5); // spoza 1/5/15 -> 5
});

test('limit prób: opóźnienia rosną, po 10 błędach wylogowanie, zapis przetrwa przeładowanie', () => {
  assert.deepEqual([1, 2].map(L.delayAfter), [0, 0]);
  assert.deepEqual([3, 4, 5, 6, 7, 8, 9].map(L.delayAfter), [5000, 15000, 30000, 60000, 120000, 300000, 600000]);
  const s = store();
  let st;
  for (let i = 1; i <= 9; i++) { st = L.recordFail(s, 1000); assert.equal(st.n, i); assert.equal(st.logout, false); }
  assert.equal(st.wait, 600000);
  assert.equal(L.failState(s, 1000 + 600000).wait, 0); // po czasie można próbować
  assert.equal(L.failState(s, 1000 + 300000).wait, 300000);
  assert.equal(L.recordFail(s, 2000).logout, true);
  L.clearFails(s);
  assert.deepEqual(L.failState(s, 0), { n: 0, wait: 0, logout: false });
});

test('uszkodzone dane w localStorage nie wywracają blokady', () => {
  const s = store();
  s.setItem(L.FAIL_KEY, '{zepsute'); s.setItem(L.LOCK_KEY, 'x');
  assert.equal(L.failState(s).n, 0);
  assert.equal(L.loadLock(s), null);
  assert.equal(L.loadLock({ getItem() { throw new Error('zablokowane'); } }), null);
});

test('blokada po powrocie do karty: próg 1/5/15 minut', () => {
  assert.ok(!L.awayLocks(0, 1e9, 5));
  assert.ok(!L.awayLocks(1000, 1000 + 59999, 1));
  assert.ok(L.awayLocks(1000, 1000 + 60000, 1));
  assert.ok(!L.awayLocks(1000, 1000 + 299999, 5));
  assert.ok(L.awayLocks(1000, 1000 + 15 * 60000, 15));
  assert.ok(L.awayLocks(1000, 1000 + 5 * 60000, 99)); // nieznana wartość -> 5
});

test('wylogowanie po bezczynności: wyłączone / 1 h / 8 h / 24 h', () => {
  assert.ok(!L.idleExpired(1000, 1e12, 0));
  assert.ok(!L.idleExpired(0, 1e12, 1));
  assert.ok(!L.idleExpired(1000, 1000 + 3600000 - 1, 1));
  assert.ok(L.idleExpired(1000, 1000 + 3600000, 1));
  assert.ok(L.idleExpired(1000, 1000 + 8 * 3600000, 8));
  assert.ok(!L.idleExpired(1000, 1000 + 23 * 3600000, 24));
  const s = store();
  assert.equal(L.loadIdleHours(s), 0);
  L.saveIdleHours(8, s); assert.equal(L.loadIdleHours(s), 8);
  s.setItem(L.IDLE_KEY, '5'); assert.equal(L.loadIdleHours(s), 0);
});

function boot({ path = '/', native = false, rec, unlocked, seen }) {
  const ls = store(), ss = store();
  if (rec) ls.setItem(L.LOCK_KEY, JSON.stringify(rec));
  if (unlocked) ss.setItem(L.UNLOCKED_KEY, '1');
  if (seen) ss.setItem(L.SEEN_KEY, String(seen));
  const dataset = {};
  vm.runInNewContext(L.BOOT_SCRIPT, { document: { documentElement: { dataset, classList: { contains: () => native } } },
    location: { pathname: path }, localStorage: ls, sessionStorage: ss, JSON, Date });
  return dataset.applock;
}
const REC = { hash: 'h', salt: 's', mins: 5 };

test('skrypt startowy: zasłania tylko, gdy jest PIN, karta nieodblokowana i nie aplikacja ani strona logowania', () => {
  assert.equal(boot({ rec: REC }), 'locked');
  assert.equal(boot({}), undefined);
  assert.equal(boot({ rec: REC, native: true }), undefined);
  assert.equal(boot({ rec: REC, path: '/login' }), undefined);
  assert.equal(boot({ rec: REC, unlocked: true }), undefined);
  assert.equal(boot({ rec: REC, unlocked: true, seen: Date.now() - 6 * 60000 }), 'locked');
  assert.equal(boot({ rec: REC, unlocked: true, seen: Date.now() - 60000 }), undefined);
});

test('zalogowanie: odblokowuje kartę, zeruje bezczynność, PIN innej osoby przestaje obowiązywać', async () => {
  const ls = store(), ss = store();
  const old = { localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
  Object.assign(globalThis, { localStorage: ls, sessionStorage: ss });
  try {
    L.saveLock(await L.makeRecord('4821', 5));
    ls.setItem(L.ACTIVE_KEY, '1');
    L.markFreshLogin('Ania');
    assert.ok(L.loadLock(), 'pierwsze logowanie nie usuwa blokady');
    assert.equal(ss.getItem(L.UNLOCKED_KEY), '1');
    assert.ok(Number(ls.getItem(L.ACTIVE_KEY)) > 1);
    L.markFreshLogin('ania');
    assert.ok(L.loadLock(), 'ta sama osoba zachowuje PIN');
    L.markFreshLogin('bartek');
    assert.equal(L.loadLock(), null, 'inna osoba: PIN usunięty');
  } finally { Object.assign(globalThis, old); }
});
