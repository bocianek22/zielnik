// POM-17: wycinek trafienia w „Moich notatkach” (lib/notes-snippet.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { snippet } from '../lib/notes-snippet.js';

test('dopasowanie bez polskich znaków i wielkości liter, oryginalny tekst w trafieniu', () => {
  const r = snippet('Po Żółtym gorzej spałam', 'zolty');
  assert.deepEqual(r, { before: 'Po ', hit: 'Żółty', after: 'm gorzej spałam' });
});

test('kilka słów: wszystkie muszą wystąpić', () => {
  assert.ok(snippet('ból głowy rano, wieczorem lepiej', 'bol wieczor'));
  assert.equal(snippet('ból głowy rano', 'bol wieczor'), null);
  assert.equal(snippet('cokolwiek', '   '), null);
});

test('długi tekst: wycinek z wielokropkami wokół trafienia', () => {
  const text = `${'a '.repeat(100)}SZUKANE ${'b '.repeat(100)}`;
  const r = snippet(text, 'szukane');
  assert.equal(r.hit, 'SZUKANE');
  assert.ok(r.before.startsWith('…') && r.after.endsWith('…'));
  assert.ok((r.before + r.hit + r.after).length <= 95);
});
