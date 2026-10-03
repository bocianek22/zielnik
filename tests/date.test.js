// Wspólny format daty (lib/date.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDay } from '../lib/date.js';

test('formatDay: sama data i północ UTC dają ten sam dzień', () => {
  assert.equal(formatDay('2026-10-03'), '3 października 2026');
  assert.equal(formatDay('2026-10-03T00:00:00.000Z'), '3 października 2026');
  assert.equal(formatDay('2026-01-01'), '1 stycznia 2026');
});

test('formatDay: znacznik czasu w ciągu dnia', () => {
  assert.equal(formatDay('2026-10-03T12:30:00Z'), '3 października 2026');
});

test('formatDay: brak lub błędna wartość to kreska', () => {
  assert.equal(formatDay(null), '–');
  assert.equal(formatDay(''), '–');
  assert.equal(formatDay('nie-data'), '–');
});
