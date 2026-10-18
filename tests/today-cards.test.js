// Układ panelu „Dziś” (UI 5 etap 3): kolejność, ukrywanie, gotowe układy (lib/today-cards.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_ORDER, PRESETS, TODAY_CARDS, moveCard, parseHidden, parseOrder, presetOf } from '../lib/today-cards.js';

test('parseOrder: znane klucze w podanej kolejności, brakujące na końcu, bez powtórzeń', () => {
  assert.deepEqual(parseOrder(''), DEFAULT_ORDER);
  assert.deepEqual(parseOrder('rx,plan,rx,zly'), ['rx', 'plan', ...DEFAULT_ORDER.filter((k) => k !== 'rx' && k !== 'plan')]);
  assert.deepEqual(parseOrder(['symptoms']).length, TODAY_CARDS.length);
});

test('parseHidden: „Plan na dziś” nie do ukrycia, nieznane pomijane', () => {
  assert.deepEqual(parseHidden('plan,chart,x,chart'), ['chart']);
  assert.deepEqual(parseHidden(['tiles', 'rx']), ['tiles', 'rx']);
});

test('gotowe układy: każdy kompletny i rozpoznawany, „Plan” zawsze widoczny', () => {
  for (const p of PRESETS) {
    assert.deepEqual(parseOrder(p.order), p.order, p.key);
    assert.ok(!p.hidden.includes('plan'), p.key);
    assert.equal(presetOf(p.order, p.hidden), p.key);
  }
  assert.equal(presetOf('', ''), 'pelny');
  assert.equal(presetOf(DEFAULT_ORDER, ['rx']), null, 'własny');
});

test('moveCard: przesuwa o jedno miejsce, na krańcach bez zmian', () => {
  assert.deepEqual(moveCard(DEFAULT_ORDER, 'tiles', -1).slice(0, 2), ['tiles', 'plan']);
  assert.deepEqual(moveCard(DEFAULT_ORDER, 'plan', -1), DEFAULT_ORDER);
  assert.deepEqual(moveCard(DEFAULT_ORDER, DEFAULT_ORDER.at(-1), 1), DEFAULT_ORDER);
});
