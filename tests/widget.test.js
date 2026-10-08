// Widżet Androida (POM-13): lib/widget.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysLeft, widgetPayload } from '../lib/widget.js';

const today = '2026-10-08';

test('daysLeft: pełne dni, null bez zapasu lub zużycia', () => {
  assert.equal(daysLeft(10, 3), 3);
  assert.equal(daysLeft(0, 3), null);
  assert.equal(daysLeft(10, 0), null);
  assert.equal(daysLeft(2.9, 1), 2);
});

test('widgetPayload: tylko susz (g)', () => {
  assert.deepEqual(widgetPayload({ stock: { g: 10, ml: 0 }, dailyUse: { g: 2, ml: 0 }, today }), { until: '2026-10-13' });
});

test('widgetPayload: tylko ml', () => {
  assert.deepEqual(widgetPayload({ stock: { g: 0, ml: 6 }, dailyUse: { g: 0, ml: 2 }, today }), { until: '2026-10-11' });
});

test('widgetPayload: oba, minimum z prognoz', () => {
  assert.deepEqual(widgetPayload({ stock: { g: 30, ml: 6 }, dailyUse: { g: 1, ml: 2 }, today }), { until: '2026-10-11' });
});

test('widgetPayload: brak zużycia albo zapas 0 daje null', () => {
  assert.deepEqual(widgetPayload({ stock: { g: 10, ml: 0 }, dailyUse: { g: 0, ml: 0 }, today }), { until: null });
  assert.deepEqual(widgetPayload({ stock: { g: 0, ml: 0 }, dailyUse: { g: 2, ml: 1 }, today }), { until: null });
});

test('widgetPayload: przekroczenie miesiąca i roku, tylko klucz until', () => {
  const p = widgetPayload({ stock: { g: 10, ml: 0 }, dailyUse: { g: 1, ml: 0 }, today: '2026-12-28' });
  assert.deepEqual(p, { until: '2027-01-07' });
  assert.deepEqual(Object.keys(p), ['until']);
});

test('widgetPayload: zła data dnia daje null', () => {
  assert.deepEqual(widgetPayload({ stock: { g: 10 }, dailyUse: { g: 1 } , today: 'x' }), { until: null });
});
