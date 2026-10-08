// Testy szyfrowania notatek (POM-28), czysta logika: uruchom `npm test`
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { LOCKED_NOTE, decryptField, decryptStrict, encryptField, isEncrypted, keyStatus, kidOf, parseKeys, planNote, readNote, rowScope } from '../lib/data-crypto.js';

const b64 = () => randomBytes(32).toString('base64');
const K1 = `k1:${b64()}`, K2 = `k2:${b64()}`;
const saved = process.env.DATA_ENCRYPTION_KEY;
afterEach(() => { if (saved === undefined) delete process.env.DATA_ENCRYPTION_KEY; else process.env.DATA_ENCRYPTION_KEY = saved; });

test('obieg: szyfrogram ma prefiks i kid, bez jawnego tekstu, odczyt zwraca oryginał', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  const text = 'Pomaga na sen, zażółć gęślą jaźń 🌿';
  const enc = encryptField('symptom_log', 'note', 7, text);
  assert.ok(isEncrypted(enc) && enc.startsWith('zenc1:k1:'));
  assert.ok(!enc.includes('Pomaga'));
  assert.equal(decryptField('symptom_log', 'note', 7, enc), text);
  assert.notEqual(enc, encryptField('symptom_log', 'note', 7, text), 'losowy iv');
});

test('pusty tekst zostaje pusty, jawny tekst bez prefiksu wraca bez zmian', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  assert.equal(encryptField('user_strain', 'notes', 1, ''), '');
  assert.equal(encryptField('user_strain', 'notes', 1, null), '');
  assert.equal(decryptField('user_strain', 'notes', 1, ''), '');
  assert.equal(decryptField('user_strain', 'notes', 1, 'stara notatka'), 'stara notatka');
});

test('AAD: szyfrogram innego konta lub kolumny daje znacznik, nie treść', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  const enc = encryptField('prescriptions', 'note', 5, 'dr Nowak');
  assert.equal(decryptField('prescriptions', 'note', 6, enc), LOCKED_NOTE);
  assert.equal(decryptField('symptom_log', 'note', 5, enc), LOCKED_NOTE);
  assert.throws(() => decryptStrict('prescriptions', 'note', 6, enc));
});

test('rotacja: pierwszy klucz szyfruje, stary nadal odszyfrowuje; bez starego znacznik', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  const old = encryptField('strain_tests', 'note', 3, 'test');
  process.env.DATA_ENCRYPTION_KEY = `${K2},${K1}`;
  assert.equal(kidOf(old), 'k1');
  assert.equal(decryptField('strain_tests', 'note', 3, old), 'test');
  const fresh = encryptField('strain_tests', 'note', 3, 'test');
  assert.equal(kidOf(fresh), 'k2');
  process.env.DATA_ENCRYPTION_KEY = K2;
  assert.equal(decryptField('strain_tests', 'note', 3, fresh), 'test');
  assert.equal(decryptField('strain_tests', 'note', 3, old), LOCKED_NOTE);
});

test('bez klucza: zapis jawny, szyfrogram nieczytelny (znacznik)', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  const enc = encryptField('symptom_log', 'note', 1, 'sekret');
  delete process.env.DATA_ENCRYPTION_KEY;
  assert.equal(keyStatus().state, 'off');
  assert.equal(encryptField('symptom_log', 'note', 1, 'jawny'), 'jawny');
  assert.equal(decryptField('symptom_log', 'note', 1, enc), LOCKED_NOTE);
});

test('zły klucz i uszkodzony szyfrogram: znacznik; zły format: zapis odmawia', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  const enc = encryptField('symptom_log', 'note', 1, 'sekret');
  process.env.DATA_ENCRYPTION_KEY = `k1:${b64()}`;
  assert.equal(decryptField('symptom_log', 'note', 1, enc), LOCKED_NOTE);
  process.env.DATA_ENCRYPTION_KEY = K1;
  assert.equal(decryptField('symptom_log', 'note', 1, `${enc.slice(0, -6)}AAAAAA`), LOCKED_NOTE);
  assert.equal(decryptField('symptom_log', 'note', 1, 'zenc1:k1'), LOCKED_NOTE);
  for (const bad of ['abc', 'k1:krotki', `k1:${b64()},k1:${b64()}`, `:${b64()}`]) {
    process.env.DATA_ENCRYPTION_KEY = bad;
    assert.equal(keyStatus().state, 'invalid');
    assert.throws(() => encryptField('symptom_log', 'note', 1, 'x'));
  }
});

test('parseKeys i keyStatus: tylko kid, bez wartości kluczy', () => {
  assert.deepEqual(parseKeys(''), []);
  assert.deepEqual(parseKeys(`${K2}, ${K1}`).map((k) => k.kid), ['k2', 'k1']);
  process.env.DATA_ENCRYPTION_KEY = `${K2},${K1}`;
  assert.deepEqual(keyStatus(), { state: 'ok', kids: ['k2', 'k1'], primary: 'k2' });
});

test('zplain: jawny tekst zaczynający się od zenc1:/zplain: bez klucza dostaje prefiks, odczyt go zdejmuje', () => {
  delete process.env.DATA_ENCRYPTION_KEY;
  for (const t of ['zenc1:k1:abc', 'zplain:x', 'zwykły']) {
    const stored = encryptField('symptom_log', 'note', 'o', t);
    assert.equal(isEncrypted(stored), false);
    assert.equal(decryptField('symptom_log', 'note', 'o', stored), t);
    assert.deepEqual(readNote('symptom_log', 'note', 'o', stored), { text: t, locked: false });
  }
  assert.equal(encryptField('symptom_log', 'note', 'o', 'zenc1:k1:abc'), 'zplain:zenc1:k1:abc');
});

test('zakres AAD: klucz wiersza razem z kontem, szyfrogram z innego wiersza tego samego konta jest nieczytelny', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  assert.equal(rowScope('symptom_log', { user_id: 1, day: '2026-10-08T00:00:00Z' }), '1|2026-10-08');
  assert.equal(rowScope('user_strain', { user_id: 1, strain_id: 5 }), '1|5');
  assert.equal(rowScope('prescriptions', { user_id: 1, id: 9 }), '1|9');
  assert.equal(rowScope('strain_tests', { id: 3, user_id: null }), '3');
  const enc = encryptField('user_strain', 'notes', rowScope('user_strain', { user_id: 1, strain_id: 5 }), 'a');
  assert.equal(readNote('user_strain', 'notes', rowScope('user_strain', { user_id: 1, strain_id: 6 }), enc).locked, true);
});

test('planNote: znacznik i pusty tekst nie nadpisują nieczytelnego szyfrogramu; zły format klucza = unavailable', () => {
  process.env.DATA_ENCRYPTION_KEY = K1;
  const enc = encryptField('symptom_log', 'note', 's', 'sekret');
  assert.deepEqual(planNote('symptom_log', 'note', 's', 'nowa', enc).keep, false);
  assert.equal(planNote('symptom_log', 'note', 's', '', enc).keep, false, 'czytelną notatkę da się skasować');
  delete process.env.DATA_ENCRYPTION_KEY; // klucz zniknął: szyfrogram nieczytelny
  assert.deepEqual(planNote('symptom_log', 'note', 's', '', enc), { value: enc, keep: true, unavailable: false });
  assert.deepEqual(planNote('symptom_log', 'note', 's', LOCKED_NOTE, enc), { value: enc, keep: true, unavailable: false });
  assert.deepEqual(planNote('symptom_log', 'note', 's', LOCKED_NOTE, null), { value: '', keep: true, unavailable: false });
  assert.equal(planNote('symptom_log', 'note', 's', 'nowa', enc).keep, false, 'nowy tekst zastępuje (zapis jawny bez klucza)');
  process.env.DATA_ENCRYPTION_KEY = 'zly-format';
  assert.deepEqual(planNote('symptom_log', 'note', 's', 'nowa', enc), { value: enc, keep: true, unavailable: true });
  assert.equal(planNote('symptom_log', 'note', 's', '', enc).keep, true);
  assert.deepEqual(planNote('symptom_log', 'note', 's', '', ''), { value: '', keep: false, unavailable: false });
});
