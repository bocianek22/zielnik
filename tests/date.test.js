// Wspólny format daty (lib/date.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDay, todayPL, isoPL, addDaysIso } from '../lib/date.js';

test('formatDay: sama data i północ UTC dają ten sam dzień', () => {
  assert.equal(formatDay('2026-10-03'), '3 października 2026');
  assert.equal(formatDay('2026-10-03T00:00:00.000Z'), '3 października 2026');
  assert.equal(formatDay('2026-01-01'), '1 stycznia 2026');
});

test('formatDay: znacznik czasu w ciągu dnia', () => {
  assert.equal(formatDay('2026-10-03T12:30:00Z'), '3 października 2026');
  assert.equal(formatDay('2026-10-03 23:30'), '3 października 2026', 'czas polski z bazy bez strefy');
  assert.equal(formatDay('2026-10-03T22:30:00Z'), '4 października 2026', '00:30 w Polsce to już następny dzień');
});

test('formatDay: brak lub błędna wartość to kreska', () => {
  assert.equal(formatDay(null), '–');
  assert.equal(formatDay(''), '–');
  assert.equal(formatDay('nie-data'), '–');
});

test('todayPL: dzień w czasie polskim, także tuż po północy', () => {
  // lato (UTC+2): 22:30 UTC to już 00:30 następnego dnia
  assert.equal(todayPL(new Date('2026-07-14T22:30:00Z')), '2026-07-15');
  assert.equal(todayPL(new Date('2026-07-14T21:59:00Z')), '2026-07-14');
  // zima (UTC+1): 23:30 UTC to 00:30 następnego dnia, 22:59 UTC to jeszcze ten sam dzień
  assert.equal(todayPL(new Date('2026-01-31T23:30:00Z')), '2026-02-01');
  assert.equal(todayPL(new Date('2026-01-31T22:59:00Z')), '2026-01-31');
  // przełom roku i niedziele zmiany czasu
  assert.equal(todayPL(new Date('2026-12-31T23:00:00Z')), '2027-01-01');
  assert.equal(todayPL(new Date('2026-03-28T23:30:00Z')), '2026-03-29');
  assert.equal(todayPL(new Date('2026-10-25T22:30:00Z')), '2026-10-25', 'po zmianie na czas zimowy 22:30 UTC to 23:30');
  assert.equal(todayPL(new Date('2026-10-24T22:30:00Z')), '2026-10-25', 'przed zmianą 22:30 UTC to 00:30');
  assert.match(todayPL(), /^\d{4}-\d{2}-\d{2}$/);
});

test('isoPL i addDaysIso', () => {
  assert.equal(isoPL(new Date('2026-10-03T12:00:00Z')), '2026-10-03');
  assert.equal(addDaysIso('2026-10-03', -30), '2026-09-03');
  assert.equal(addDaysIso('2026-03-01', -1), '2026-02-28');
  assert.equal(addDaysIso('2026-10-25', 1), '2026-10-26');
});
