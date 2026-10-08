// Testy szyfrowania notatek (POM-28), czysta logika: uruchom `npm test`
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { LOCKED_NOTE, decryptField, decryptStrict, encryptField, isEncrypted, keyStatus, kidOf, parseKeys } from '../lib/data-crypto.js';

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
