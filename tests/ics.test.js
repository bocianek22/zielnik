// Plik kalendarza (lib/ics.js): `npm test`
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../lib/ics.js';

const now = new Date('2026-10-19T10:00:00Z');

test('wydarzenie całodniowe z przypomnieniem dzień wcześniej, CRLF', () => {
  const t = buildIcs({ kind: 'wykup', day: '2026-10-24', now });
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\n') && t.endsWith('END:VCALENDAR\r\n'));
  assert.match(t, /DTSTART;VALUE=DATE:20261024\r\n/);
  assert.match(t, /DTEND;VALUE=DATE:20261025\r\n/);
  assert.match(t, /SUMMARY:Apteka: wykup\r\n/);
  assert.match(t, /TRIGGER:-PT15H/);
  assert.match(t, /DTSTAMP:20261019T100000Z/);
});

test('tryb dyskretny: neutralny tytuł; zły rodzaj lub dzień: null', () => {
  const t = buildIcs({ kind: 'wizyta', day: '2026-12-31', discreet: true, now });
  assert.match(t, /SUMMARY:Spotkanie/);
  assert.doesNotMatch(t, /lekarz|Apteka|recept/i);
  assert.match(t, /DTEND;VALUE=DATE:20270101/);
  assert.equal(buildIcs({ kind: 'inne', day: '2026-10-24' }), null);
  assert.equal(buildIcs({ kind: 'wykup', day: '24.10.2026' }), null);
});
