// „Ukryj po wyjściu z aplikacji” (POM-60, lib/discreet.js): decyzja tylko przy zejściu do tła, z włączoną opcją
// i gdy tryb dyskretny jeszcze nie działa.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hideOnLeave } from '../lib/discreet.js';

test('hideOnLeave: ukrywa tylko przy wyjściu z włączoną opcją', () => {
  assert.equal(hideOnLeave({ auto: true, visibility: 'hidden', discreet: false }), true);
  assert.equal(hideOnLeave({ auto: true, visibility: 'visible', discreet: false }), false, 'powrót nie przełącza');
  assert.equal(hideOnLeave({ auto: false, visibility: 'hidden', discreet: false }), false);
  assert.equal(hideOnLeave({ auto: true, visibility: 'hidden', discreet: true }), false, 'już ukryte');
});
