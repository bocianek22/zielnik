// Karta terapii po polsku i po angielsku (POM-64): te same klucze, daty i liczby w formacie języka. `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARD_TEXT, cardLang, cardDay, cardQty } from '../lib/travel-card-text.js';

test('teksty karty: oba języki mają te same klucze i tyle samo punktów listy', () => {
  assert.deepEqual(Object.keys(CARD_TEXT.en).sort(), Object.keys(CARD_TEXT.pl).sort());
  assert.equal(CARD_TEXT.en.check.length, CARD_TEXT.pl.check.length);
  for (const [k, v] of Object.entries(CARD_TEXT.en)) assert.equal(typeof v, typeof CARD_TEXT.pl[k], k);
});

test('język karty: tylko pl i en, reszta to polski; daty i ilości w formacie języka', () => {
  assert.equal(cardLang('en'), 'en');
  assert.equal(cardLang('xx'), 'pl');
  assert.equal(cardLang(undefined), 'pl');
  assert.equal(cardDay('2026-10-08', 'pl'), '8 października 2026');
  assert.equal(cardDay('2026-10-08', 'en'), '8 October 2026');
  assert.equal(cardQty(4.5, 'g', 'pl'), '4,5 g');
  assert.equal(cardQty(4.5, 'ml', 'en'), '4.5 ml');
});
