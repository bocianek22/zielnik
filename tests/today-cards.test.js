// POM-48: lista ukrytych kart panelu „Dziś” (lib/today-cards.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHidden, TODAY_CARDS } from '../lib/today-cards.js';

test('parseHidden: tylko znane klucze, bez powtórzeń, z napisu i z tablicy', () => {
  assert.deepEqual(parseHidden(''), []);
  assert.deepEqual(parseHidden(null), []);
  assert.deepEqual(parseHidden('chart, rx,chart,nieznana'), ['chart', 'rx']);
  assert.deepEqual(parseHidden(['streak', 'streak', 5, '<script>']), ['streak']);
  assert.deepEqual(parseHidden(TODAY_CARDS.map((c) => c.key)), ['chart', 'symptoms', 'streak', 'rx']);
});
